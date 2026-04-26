"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { ListTodo, ChevronDown, ChevronUp, Pencil, Trash2, Plus } from "lucide-react";
import type { ManagerPeriodicTask, Task, User } from "@/lib/types/database";
import { ManagerPeriodicTasksTab } from "@/components/shared/manager-periodic-tasks-tab";

const NO_LINKED_MONTHLY_VALUE = "__no_linked_monthly__";

export type TaskAssignmentPanelProps = {
  mode: "admin" | "manager" | "employee";
  organizationId: string;
  currentUserId: string;
  assignableUsers: User[];
  tasks: Task[];
  /** Monthly numeric tasks in the org (for daily→monthly link); managers may read all org tasks per RLS */
  monthlyNumericLinkOptions: Task[];
  /** Monthly numeric periodic templates (manager); optional daily rollup target via cron resolution */
  monthlyPeriodicLinkOptions?: ManagerPeriodicTask[];
  onTasksChanged: () => void;
  /** Manager panel: Current (tasks created today) vs History with date/employee filters */
  managerCurrentHistorySplit?: boolean;
  /** Manager-owned periodic templates (cron materializes into tasks) */
  managerPeriodicTasks?: ManagerPeriodicTask[];
};

export function TaskAssignmentPanel({
  mode,
  organizationId,
  currentUserId,
  assignableUsers,
  tasks,
  monthlyNumericLinkOptions,
  monthlyPeriodicLinkOptions = [],
  onTasksChanged,
  managerCurrentHistorySplit = false,
  managerPeriodicTasks = [],
}: TaskAssignmentPanelProps) {
  const [taskSearchTerm, setTaskSearchTerm] = useState("");
  const [mainAssignmentTab, setMainAssignmentTab] = useState("current");
  const [periodicSubTab, setPeriodicSubTab] = useState<"daily" | "weekly" | "monthly">("daily");
  const [periodicCreateTrigger, setPeriodicCreateTrigger] = useState(0);
  const [assignmentCurrentEmployeeFilter, setAssignmentCurrentEmployeeFilter] = useState("");
  const [assignmentHistoryDateFilter, setAssignmentHistoryDateFilter] = useState("");
  const [assignmentHistoryEmployeeFilter, setAssignmentHistoryEmployeeFilter] = useState("");
  const [expandedTaskRows, setExpandedTaskRows] = useState<Set<string>>(new Set());
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    task: Partial<Task> | null;
  }>({ open: false, mode: "create", task: null });
  const [taskForm, setTaskForm] = useState(() => ({
    title: "",
    description: "",
    type: "daily" as "daily" | "weekly" | "monthly",
    dayOfWeek: "",
    dueDate: "",
    assignmentType: (mode === "manager" || mode === "employee" ? "specific" : "common") as "common" | "specific",
    assignedTo: mode === "employee" ? currentUserId : "",
    /** Manager create: one task row per selected employee */
    assignedToIds: [] as string[],
    isActive: true,
    isNumericTask: false,
    numericUnit: "",
    linkedMonthlyTaskId: "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const isManager = mode === "manager";
  const isEmployee = mode === "employee";
  const splitView = Boolean(managerCurrentHistorySplit && isManager);

  const toTaskDay = (iso: string) => format(new Date(iso), "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const matchesEmployeeName = (fullName: string, term: string) =>
    !term.trim() || fullName.toLowerCase().includes(term.trim().toLowerCase());

  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      type: "daily",
      dayOfWeek: "",
      dueDate: "",
      assignmentType: isManager || isEmployee ? "specific" : "common",
      assignedTo: isEmployee ? currentUserId : "",
      assignedToIds: [],
      isActive: true,
      isNumericTask: false,
      numericUnit: "",
      linkedMonthlyTaskId: "",
    });
  };

  const assigneeOk = (userId: string) => assignableUsers.some((u) => u.id === userId);

  const openEditTaskDialog = (taskToEdit: Task) => {
    setTaskForm({
      title: taskToEdit.title ?? "",
      description: taskToEdit.description ?? "",
      type: taskToEdit.type,
      dayOfWeek: taskToEdit.day_of_week != null ? String(taskToEdit.day_of_week) : "",
      dueDate: taskToEdit.due_date ?? "",
      assignmentType: taskToEdit.is_common_task ? "common" : "specific",
      assignedTo: taskToEdit.assigned_to ?? "",
      assignedToIds: [],
      isActive: Boolean(taskToEdit.is_active),
      isNumericTask: Boolean(taskToEdit.is_numeric_task),
      numericUnit: taskToEdit.numeric_unit ?? "",
      linkedMonthlyTaskId: taskToEdit.linked_monthly_task_id ?? "",
    });
    setTaskDialog({ open: true, mode: "edit", task: taskToEdit });
  };

  const openCreateTaskDialog = () => {
    resetTaskForm();
    setTaskDialog({ open: true, mode: "create", task: null });
  };

  const validateBeforeSave = () => {
    if (isManager && taskDialog.mode === "create") {
      const ids = taskForm.assignedToIds;
      if (!ids.length || !ids.every((id) => assigneeOk(id))) {
        toast({
          title: "Error",
          description: "Select at least one team member to assign this task",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }
    if (isManager || (!isEmployee && taskForm.assignmentType === "specific")) {
      if (!taskForm.assignedTo || !assigneeOk(taskForm.assignedTo)) {
        toast({
          title: "Error",
          description: isManager
            ? "Select a team member to assign this task"
            : "Select an employee for a specific assignment",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleCreateTask = async () => {
    if (!taskForm.title) {
      toast({ title: "Error", description: "Task title is required", variant: "destructive" });
      return;
    }
    if (!validateBeforeSave()) return;

    setSubmitting(true);
    try {
      const isCommon = isManager || isEmployee ? false : taskForm.assignmentType === "common";

      const baseRow: Record<string, unknown> = {
        organization_id: organizationId,
        title: taskForm.title,
        description: taskForm.description || null,
        type: taskForm.type,
        assigned_by: currentUserId,
        is_common_task: isCommon,
        is_active: taskForm.isActive,
        is_numeric_task: taskForm.isNumericTask,
        numeric_unit: taskForm.isNumericTask ? taskForm.numericUnit : null,
        linked_monthly_task_id: taskForm.linkedMonthlyTaskId || null,
      };

      if (taskForm.type === "weekly" && taskForm.dayOfWeek) {
        baseRow.day_of_week = parseInt(taskForm.dayOfWeek, 10);
      }
      if (taskForm.type === "monthly" && taskForm.dueDate) {
        baseRow.due_date = taskForm.dueDate;
      }

      if (isManager) {
        const rows = taskForm.assignedToIds.map((userId) => ({
          ...baseRow,
          assigned_to: userId,
        }));
        const { error } = await supabase.from("tasks").insert(rows);
        if (error) throw error;
        const n = rows.length;
        toast({
          title: "Success",
          description:
            n === 1 ? "Task created successfully" : `${n} tasks created (one per selected employee)`,
        });
      } else {
        const taskData = {
          ...baseRow,
          assigned_to: isEmployee ? currentUserId : (!isCommon ? taskForm.assignedTo : null),
        };
        const { error } = await supabase.from("tasks").insert(taskData);
        if (error) throw error;
        toast({ title: "Success", description: "Task created successfully" });
      }
      setTaskDialog({ open: false, mode: "create", task: null });
      resetTaskForm();
      onTasksChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!taskDialog.task?.id || !taskForm.title) {
      toast({ title: "Error", description: "Task title is required", variant: "destructive" });
      return;
    }
    if (!validateBeforeSave()) return;

    setSubmitting(true);
    try {
      const isCommon = isManager || isEmployee ? false : taskForm.assignmentType === "common";
      const taskData: Record<string, unknown> = {
        title: taskForm.title,
        description: taskForm.description || null,
        type: taskForm.type,
        is_common_task: isCommon,
        assigned_to: isEmployee ? currentUserId : (!isCommon ? taskForm.assignedTo : null),
        is_active: taskForm.isActive,
        is_numeric_task: taskForm.isNumericTask,
        numeric_unit: taskForm.isNumericTask ? taskForm.numericUnit : null,
        linked_monthly_task_id: taskForm.linkedMonthlyTaskId || null,
      };

      if (taskForm.type === "weekly" && taskForm.dayOfWeek) {
        taskData.day_of_week = parseInt(taskForm.dayOfWeek, 10);
      } else {
        taskData.day_of_week = null;
      }
      if (taskForm.type === "monthly" && taskForm.dueDate) {
        taskData.due_date = taskForm.dueDate;
      } else {
        taskData.due_date = null;
      }

      const { error } = await supabase.from("tasks").update(taskData).eq("id", taskDialog.task.id);
      if (error) throw error;

      toast({ title: "Success", description: "Task updated successfully" });
      setTaskDialog({ open: false, mode: "create", task: null });
      resetTaskForm();
      onTasksChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      toast({ title: "Success", description: "Task deleted successfully" });
      onTasksChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(taskSearchTerm.toLowerCase())
  );

  const toggleTaskRow = (taskId: string) => {
    const next = new Set(expandedTaskRows);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setExpandedTaskRows(next);
  };

  const userName = (id: string | null) =>
    assignableUsers.find((u) => u.id === id)?.full_name ??
    (mode === "admin" ? "Unassigned" : "Unknown");

  const byCreatedDesc = (a: Task, b: Task) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const currentAssignmentTasks = tasks
    .filter((t) => {
      if (toTaskDay(t.created_at) !== todayStr) return false;
      return matchesEmployeeName(userName(t.assigned_to), assignmentCurrentEmployeeFilter);
    })
    .sort(byCreatedDesc);

  const historyAssignmentTasks = tasks
    .filter((t) => {
      const d = toTaskDay(t.created_at);
      if (assignmentHistoryDateFilter) {
        if (d !== assignmentHistoryDateFilter) return false;
      } else if (d === todayStr) {
        return false;
      }
      return matchesEmployeeName(userName(t.assigned_to), assignmentHistoryEmployeeFilter);
    })
    .sort(byCreatedDesc);

  const historyGroups: [string, Task[]][] = (() => {
    const m: Record<string, Task[]> = {};
    for (const t of historyAssignmentTasks) {
      const key = userName(t.assigned_to);
      if (!m[key]) m[key] = [];
      m[key].push(t);
    }
    for (const k of Object.keys(m)) {
      m[k].sort(byCreatedDesc);
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  })();

  const renderExpandedTaskPanel = (t: Task) => (
    <div className="py-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-1">Full Description:</p>
          <p className="text-sm text-muted-foreground">{t.description || "No description"}</p>
        </div>
        <div>
          <p className="text-sm font-medium mb-1">Details:</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Status: {t.is_active ? "Active" : "Inactive"}</p>
            {t.is_numeric_task && <p>Numeric Task: {t.numeric_unit || "units"}</p>}
            {t.type === "weekly" && t.day_of_week !== null && (
              <p>
                Day:{" "}
                {
                  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
                    t.day_of_week!
                  ]
                }
              </p>
            )}
            {t.type === "monthly" && t.due_date && <p>Due: {t.due_date}</p>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => openEditTaskDialog(t)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button size="sm" variant="destructive" onClick={() => handleDeleteTask(t.id)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );

  const renderTaskDataRows = (list: Task[], showEmployeeColumn: boolean) => {
    const colSpan = showEmployeeColumn ? 7 : 6;
    return list.map((t) => {
      const isExpanded = expandedTaskRows.has(t.id);
      const employee = userName(t.assigned_to);
      return (
        <React.Fragment key={t.id}>
          <TableRow className={isExpanded ? "bg-muted/50" : ""}>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleTaskRow(t.id)}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </TableCell>
            {showEmployeeColumn && <TableCell>{employee}</TableCell>}
            <TableCell className="font-medium">{t.title}</TableCell>
            <TableCell>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
              </span>
            </TableCell>
            <TableCell className="max-w-md">
              <p className="text-sm text-muted-foreground truncate">{t.description || "-"}</p>
            </TableCell>
            <TableCell>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  t.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
                }`}
              >
                {t.is_active ? "Active" : "Inactive"}
              </span>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {format(new Date(t.created_at), "HH:mm dd/MM/yyyy")}
            </TableCell>
          </TableRow>
          {isExpanded && (
            <TableRow>
              <TableCell colSpan={colSpan} className="bg-muted/30">
                {renderExpandedTaskPanel(t)}
              </TableCell>
            </TableRow>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <>
      {splitView ? (
        <>
          <Tabs
            value={mainAssignmentTab}
            onValueChange={setMainAssignmentTab}
            className="space-y-4"
          >
            <div className="flex w-full flex-wrap items-center gap-3">
              <TabsList className="flex h-auto flex-wrap gap-1">
                <TabsTrigger value="current">
                  Current ({currentAssignmentTasks.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  History ({historyAssignmentTasks.length})
                </TabsTrigger>
                <TabsTrigger value="periodic">
                  Periodic tasks ({managerPeriodicTasks.length})
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex shrink-0">
                <Button
                  type="button"
                  onClick={() => {
                    if (mainAssignmentTab === "periodic") {
                      setPeriodicCreateTrigger((n) => n + 1);
                    } else {
                      openCreateTaskDialog();
                    }
                  }}
                  disabled={mainAssignmentTab !== "periodic" && assignableUsers.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {mainAssignmentTab === "periodic" ? "Create periodic task" : "Create Task"}
                </Button>
              </div>
            </div>

            <TabsContent value="current" className="space-y-4">
              <Input
                placeholder="Search by employee name..."
                value={assignmentCurrentEmployeeFilter}
                onChange={(e) => setAssignmentCurrentEmployeeFilter(e.target.value)}
                className="max-w-md"
              />
              {currentAssignmentTasks.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]" />
                        <TableHead>Employee</TableHead>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Task Type</TableHead>
                        <TableHead>Task Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created at</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{renderTaskDataRows(currentAssignmentTasks, true)}</TableBody>
                  </Table>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No tasks created today
                    {assignmentCurrentEmployeeFilter.trim()
                      ? " for this filter"
                      : ""}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Search by employee name..."
                  value={assignmentHistoryEmployeeFilter}
                  onChange={(e) => setAssignmentHistoryEmployeeFilter(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={assignmentHistoryDateFilter}
                  onChange={(e) => setAssignmentHistoryDateFilter(e.target.value)}
                  className="w-full sm:w-44"
                />
              </div>
              {historyGroups.length > 0 ? (
                <div className="space-y-2">
                  {historyGroups.map(([employeeName, groupTasks]) => (
                    <details key={employeeName} className="rounded-lg border">
                      <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                        {employeeName} &mdash; {groupTasks.length} task
                        {groupTasks.length !== 1 ? "s" : ""}
                      </summary>
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]" />
                              <TableHead>Task Name</TableHead>
                              <TableHead>Task Type</TableHead>
                              <TableHead>Task Description</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Created at</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>{renderTaskDataRows(groupTasks, false)}</TableBody>
                        </Table>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No task history
                    {assignmentHistoryDateFilter || assignmentHistoryEmployeeFilter.trim()
                      ? " for this filter"
                      : ""}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="periodic" className="space-y-4">
              <ManagerPeriodicTasksTab
                periodicTasks={managerPeriodicTasks}
                monthlyNumericLinkOptions={monthlyNumericLinkOptions}
                monthlyPeriodicLinkOptions={monthlyPeriodicLinkOptions}
                organizationId={organizationId}
                managerId={currentUserId}
                onRefresh={onTasksChanged}
                periodicSubTab={periodicSubTab}
                onPeriodicSubTabChange={setPeriodicSubTab}
                periodicCreateTrigger={periodicCreateTrigger}
                assignableUsers={assignableUsers}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search tasks..."
              value={taskSearchTerm}
              onChange={(e) => setTaskSearchTerm(e.target.value)}
              className="w-1/3"
            />
            <Button onClick={openCreateTaskDialog} disabled={isManager && assignableUsers.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>

          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ListTodo className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {taskSearchTerm
                    ? "Try a different search term"
                    : isManager
                      ? assignableUsers.length === 0
                        ? "Add direct reports to assign tasks"
                        : "Create tasks assigned to your team members"
                      : "Create tasks to assign to your team"}
                </p>
              </CardContent>
            </Card>
          ) : (
            (() => {
              const groups: Record<string, Task[]> = {};
              for (const t of filteredTasks) {
                const key = t.is_common_task ? "All Employees" : userName(t.assigned_to);
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
              }
              const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
                if (a === "All Employees") return -1;
                if (b === "All Employees") return 1;
                return a.localeCompare(b);
              });

              return (
                <div className="space-y-2">
                  {sortedGroups.map(([employeeName, groupTasks]) => (
                    <details key={employeeName} className="rounded-lg border">
                      <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                        {employeeName} &mdash; {groupTasks.length} task
                        {groupTasks.length !== 1 ? "s" : ""}
                      </summary>
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40px]"></TableHead>
                              <TableHead>Task Name</TableHead>
                              <TableHead>Task Type</TableHead>
                              <TableHead>Task Description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupTasks.map((t) => {
                              const isExpanded = expandedTaskRows.has(t.id);
                              return (
                                <React.Fragment key={t.id}>
                                  <TableRow className={isExpanded ? "bg-muted/50" : ""}>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleTaskRow(t.id)}
                                        className="h-8 w-8 p-0"
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TableCell>
                                    <TableCell className="font-medium">{t.title}</TableCell>
                                    <TableCell>
                                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                        {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                      <p className="text-sm text-muted-foreground truncate">
                                        {t.description || "-"}
                                      </p>
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={4} className="bg-muted/30">
                                        {renderExpandedTaskPanel(t)}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  ))}
                </div>
              );
            })()
          )}
        </>
      )}

      <Dialog
        open={taskDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setTaskDialog({ open: false, mode: "create", task: null });
            resetTaskForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {taskDialog.mode === "create" ? "Create New Task" : "Edit Task"}
            </DialogTitle>
            <DialogDescription>
              {taskDialog.mode === "create"
                ? isManager
                  ? "Create a task for one or more members of your team (each gets their own task record)"
                  : "Create a new task for your organization"
                : "Update task information"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Title (required)</Label>
              <Input
                id="taskTitle"
                type="text"
                placeholder="Task title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskDescription">Description (optional)</Label>
              <Textarea
                id="taskDescription"
                placeholder="Task description"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskType">Type</Label>
              <Select
                value={taskForm.type}
                onValueChange={(value: "daily" | "weekly" | "monthly") =>
                  setTaskForm({ ...taskForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Input
                readOnly
                tabIndex={-1}
                className="bg-muted/50 cursor-default"
                value={
                  taskDialog.mode === "edit" && taskDialog.task?.source_manager_periodic_task_id
                    ? "Periodic"
                    : "Once"
                }
              />
              <p className="text-xs text-muted-foreground">
                Periodic applies to tasks materialized from a template; new tasks you create here are Once.
              </p>
            </div>

            {taskForm.type === "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="dayOfWeek">Day of Week</Label>
                <Select
                  value={taskForm.dayOfWeek}
                  onValueChange={(value) => setTaskForm({ ...taskForm, dayOfWeek: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {taskForm.type === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
            )}

            {!isManager && !isEmployee && (
              <div className="space-y-2">
                <Label>Assignment Type</Label>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="common"
                      checked={taskForm.assignmentType === "common"}
                      onChange={() =>
                        setTaskForm({
                          ...taskForm,
                          assignmentType: "common",
                          assignedTo: "",
                          assignedToIds: [],
                        })
                      }
                    />
                    <span className="text-sm">Common Task (All Employees)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="specific"
                      checked={taskForm.assignmentType === "specific"}
                      onChange={() => setTaskForm({ ...taskForm, assignmentType: "specific" })}
                    />
                    <span className="text-sm">Specific Employee</span>
                  </label>
                </div>
              </div>
            )}

            {isManager && taskDialog.mode === "create" ? (
              <div className="space-y-2">
                <Label>Assign to (select one or more)</Label>
                <div className="rounded-md border max-h-52 overflow-y-auto p-3 space-y-2 bg-muted/20">
                  {assignableUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team members to assign</p>
                  ) : (
                    assignableUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={taskForm.assignedToIds.includes(u.id)}
                          onChange={() => {
                            setTaskForm((prev) => ({
                              ...prev,
                              assignedToIds: prev.assignedToIds.includes(u.id)
                                ? prev.assignedToIds.filter((id) => id !== u.id)
                                : [...prev.assignedToIds, u.id],
                            }));
                          }}
                        />
                        <span>
                          {u.full_name}{" "}
                          <span className="text-muted-foreground">({u.role})</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {assignableUsers.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTaskForm((prev) => ({
                          ...prev,
                          assignedToIds: assignableUsers.map((x) => x.id),
                        }))
                      }
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTaskForm((prev) => ({ ...prev, assignedToIds: [] }))}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              (isManager || (!isEmployee && taskForm.assignmentType === "specific")) && (
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assign To</Label>
                  <Select
                    value={taskForm.assignedTo}
                    onValueChange={(value) => setTaskForm({ ...taskForm, assignedTo: value })}
                  >
                    <SelectTrigger id="assignedTo">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={taskForm.isActive}
                onChange={(e) => setTaskForm({ ...taskForm, isActive: e.target.checked })}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isNumericTask"
                checked={taskForm.isNumericTask}
                onChange={(e) => setTaskForm({ ...taskForm, isNumericTask: e.target.checked })}
              />
              <Label htmlFor="isNumericTask" className="cursor-pointer">
                Numeric Task
              </Label>
            </div>

            {taskForm.isNumericTask && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="numericUnit">Unit Label (e.g., &quot;certificates&quot;, &quot;items&quot;)</Label>
                  <Input
                    id="numericUnit"
                    type="text"
                    placeholder="certificates"
                    value={taskForm.numericUnit}
                    onChange={(e) => setTaskForm({ ...taskForm, numericUnit: e.target.value })}
                  />
                </div>

                {taskForm.type === "daily" && (
                  <div className="space-y-2">
                    <Label htmlFor="linkedMonthlyTask">Link to Monthly Task (optional)</Label>
                    <Select
                      value={taskForm.linkedMonthlyTaskId || NO_LINKED_MONTHLY_VALUE}
                      onValueChange={(value) =>
                        setTaskForm({
                          ...taskForm,
                          linkedMonthlyTaskId:
                            value === NO_LINKED_MONTHLY_VALUE ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select monthly task for auto-calculation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_LINKED_MONTHLY_VALUE}>None</SelectItem>
                        {monthlyNumericLinkOptions.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Daily numeric values will automatically sum into the linked monthly task
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="mt-auto pt-2 border-t sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setTaskDialog({ open: false, mode: "create", task: null });
                resetTaskForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={taskDialog.mode === "create" ? handleCreateTask : handleUpdateTask}
              disabled={
                submitting ||
                !taskForm.title ||
                (isManager &&
                  taskDialog.mode === "create" &&
                  taskForm.assignedToIds.length === 0)
              }
            >
              {submitting ? "Saving..." : taskDialog.mode === "create" ? "Create Task" : "Update Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
