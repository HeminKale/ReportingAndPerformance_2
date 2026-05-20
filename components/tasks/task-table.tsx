"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Task, TaskLog } from "@/lib/types/database";
import { PriorityBadge } from "@/components/gamification/priority-badge";

interface TaskWithLog extends Task {
  taskLog?: TaskLog;
}

interface TaskTableProps {
  tasks: TaskWithLog[];
  onSubmit: (task: Task) => void;
  onView: (task: Task, taskLog?: TaskLog) => void;
  /** Shown in the table body when there are zero rows (headers still visible). */
  emptyMessage?: string;
  hideDueColumn?: boolean;
  hideFrequencyColumn?: boolean;
}

export function TaskTable({ tasks, onSubmit, onView, emptyMessage = "No tasks found", hideDueColumn = false, hideFrequencyColumn = false }: TaskTableProps) {
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);

  const getStatusBadge = (taskLog?: TaskLog) => {
    if (!taskLog) return <Badge variant="outline">Not Submitted</Badge>;

    if (taskLog.verification_status === "pending") {
      return <Badge className="rounded-full bg-amber-100 text-amber-800">Pending Approval</Badge>;
    }
    if (taskLog.verification_status === "rejected") {
      return <Badge className="rounded-full bg-rose-100 text-rose-800">Rejected</Badge>;
    }
    if (taskLog.verification_status === "recalled") {
      return <Badge className="rounded-full bg-amber-100 text-amber-900">Recalled</Badge>;
    }
    if (taskLog.verification_status === "approved" && taskLog.status === "completed") {
      return <Badge className="rounded-full bg-emerald-100 text-emerald-800">Verified</Badge>;
    }
    if (taskLog.status === "pending") {
      return <Badge className="rounded-full bg-amber-100 text-amber-800">Pending</Badge>;
    }
    return <Badge className="rounded-full bg-blue-100 text-blue-800">Completed</Badge>;
  };

  const canSubmitTask = (taskLog?: TaskLog) => {
    if (!taskLog) return true;
    if (taskLog.verification_status === "pending") return false;
    if (taskLog.verification_status === "approved") return false;
    return true;
  };

  const resubmitLabel = (taskLog?: TaskLog, isNumeric?: boolean) => {
    if (taskLog?.verification_status === "rejected" || taskLog?.verification_status === "recalled") {
      return isNumeric ? "Re-enter Number" : "Resubmit Task";
    }
    return isNumeric ? "Enter Number" : "Submit Task";
  };

  const dueDateLabel = (task: Task) => {
    if (task.type === "daily") return "—";
    if (!task.due_date) return "—";
    return format(new Date(`${task.due_date}T12:00:00`), "dd MMM yyyy");
  };

  return (
    <div className="option-panel overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead>Task Name</TableHead>
            <TableHead>Priority</TableHead>
            {!hideFrequencyColumn && <TableHead>Frequency</TableHead>}
            {!hideDueColumn && <TableHead>Due</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Assigned At</TableHead>
            <TableHead>Submitted At</TableHead>
            <TableHead className="w-[56px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={
                  7 +
                  (hideDueColumn ? -1 : 0) +
                  (hideFrequencyColumn ? -1 : 0)
                }
                className="py-12 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
          {tasks.map((task) => {
            const taskLog = task.taskLog;
            const canSubmit = canSubmitTask(taskLog);
            const isMenuOpen = openMenuTaskId === task.id;
            
            return (
              <TableRow key={task.id}>
                <TableCell className="font-medium">
                  {task.title}
                  {task.is_numeric_task && taskLog?.numeric_value != null && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({taskLog!.numeric_value} {task.numeric_unit || "units"})
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={task.priority ?? "medium"} size="sm" />
                </TableCell>
                {!hideFrequencyColumn && (
                  <TableCell className="text-sm text-muted-foreground">
                    {task.source_manager_periodic_task_id ? "Periodic" : "Once"}
                  </TableCell>
                )}
                {!hideDueColumn && (
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {dueDateLabel(task)}
                  </TableCell>
                )}
                <TableCell>{getStatusBadge(taskLog)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(task.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell>
                  {taskLog?.submitted_at ? (
                    <span className="text-sm">
                      {format(new Date(taskLog.submitted_at), "HH:mm dd/MM/yyyy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="relative inline-block text-left">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setOpenMenuTaskId((prev) => (prev === task.id ? null : task.id))
                      }
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    {isMenuOpen && (
                      <div className="option-panel absolute right-0 z-10 mt-2 w-48 rounded-md border bg-background p-1 shadow-md">
                        {/* For numeric tasks: "Enter Number" opens the submit dialog when submittable */}
                        {task.is_numeric_task && canSubmit ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start font-medium"
                              onClick={() => {
                                onSubmit(task);
                                setOpenMenuTaskId(null);
                              }}
                            >
                              {resubmitLabel(taskLog, true)}
                            </Button>
                            {taskLog && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-muted-foreground"
                                onClick={() => {
                                  onView(task, taskLog);
                                  setOpenMenuTaskId(null);
                                }}
                              >
                                View Details
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => {
                                onView(task, taskLog);
                                setOpenMenuTaskId(null);
                              }}
                            >
                              View Details
                            </Button>
                            {canSubmit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => {
                                  onSubmit(task);
                                  setOpenMenuTaskId(null);
                                }}
                              >
                                {resubmitLabel(taskLog, false)}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
