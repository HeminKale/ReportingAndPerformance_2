"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";
import type { ManagerPeriodicTask, Task, TaskPriority } from "@/lib/types/database";
import { PriorityBadge } from "@/components/gamification/priority-badge";

const NO_LINKED_MONTHLY_VALUE = "__no_linked_monthly__";

export type ManagerPeriodicTasksTabProps = {
  periodicTasks: ManagerPeriodicTask[];
  monthlyNumericLinkOptions: Task[];
  monthlyPeriodicLinkOptions: ManagerPeriodicTask[];
  organizationId: string;
  managerId: string;
  onRefresh: () => void;
  periodicSubTab: "daily" | "weekly" | "monthly";
  onPeriodicSubTabChange: (v: "daily" | "weekly" | "monthly") => void;
  /** Increment (e.g. parent `setState(n => n + 1)`) to open create dialog from header */
  periodicCreateTrigger: number;
  /** List of direct reports for selective assignment */
  assignableUsers: { id: string; full_name: string; role: string }[];
};

type PeriodicForm = {
  title: string;
  description: string;
  type: "daily" | "weekly" | "monthly";
  dayOfWeek: string;
  monthlyDay: string;
  isNumericTask: boolean;
  numericUnit: string;
  linkedMonthlyTaskId: string;
  linkedMonthlyPeriodicId: string;
  isEnabled: boolean;
  assignedUserIds: string[];
  priority: TaskPriority;
  bonusXp: string;
};

function linkedMonthlySelectValue(form: PeriodicForm): string {
  if (form.linkedMonthlyTaskId) return `task:${form.linkedMonthlyTaskId}`;
  if (form.linkedMonthlyPeriodicId) return `periodic:${form.linkedMonthlyPeriodicId}`;
  return NO_LINKED_MONTHLY_VALUE;
}

const emptyForm = (type: "daily" | "weekly" | "monthly"): PeriodicForm => ({
  title: "",
  description: "",
  type,
  dayOfWeek: "",
  monthlyDay: "",
  isNumericTask: false,
  numericUnit: "",
  linkedMonthlyTaskId: "",
  linkedMonthlyPeriodicId: "",
  isEnabled: true,
  assignedUserIds: [],
  priority: "medium",
  bonusXp: "",
});

export function ManagerPeriodicTasksTab({
  periodicTasks,
  monthlyNumericLinkOptions,
  organizationId,
  managerId,
  onRefresh,
  periodicSubTab,
  onPeriodicSubTabChange,
  periodicCreateTrigger,
  monthlyPeriodicLinkOptions,
  assignableUsers,
}: ManagerPeriodicTasksTabProps) {
  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    row: ManagerPeriodicTask | null;
  }>({ open: false, mode: "create", row: null });
  const [form, setForm] = useState<PeriodicForm>(emptyForm("daily"));
  const [submitting, setSubmitting] = useState(false);
  const [periodicTaskNameSearch, setPeriodicTaskNameSearch] = useState("");
  const { toast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    if (periodicCreateTrigger <= 0) return;
    setForm(emptyForm(periodicSubTab));
    setDialog({ open: true, mode: "create", row: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to header "Create" bumps
  }, [periodicCreateTrigger]);

  const openEdit = (row: ManagerPeriodicTask) => {
    setForm({
      title: row.title,
      description: row.description ?? "",
      type: row.type,
      dayOfWeek: row.day_of_week != null ? String(row.day_of_week) : "",
      monthlyDay: row.monthly_day != null ? String(row.monthly_day) : "",
      isNumericTask: row.is_numeric_task,
      numericUnit: row.numeric_unit ?? "",
      linkedMonthlyTaskId: row.linked_monthly_task_id ?? "",
      linkedMonthlyPeriodicId: row.linked_monthly_task_id
        ? ""
        : (row.linked_monthly_periodic_id ?? ""),
      isEnabled: row.is_enabled,
      assignedUserIds: row.assigned_user_ids ?? [],
      priority: (row.priority ?? "medium") as TaskPriority,
      bonusXp:
        row.assignment_xp_override !== null && row.assignment_xp_override !== undefined
          ? String(row.assignment_xp_override)
          : "",
    });
    setDialog({ open: true, mode: "edit", row });
  };

  const closeDialog = () => {
    setDialog({ open: false, mode: "create", row: null });
    setForm(emptyForm(periodicSubTab));
  };

  const validate = (): boolean => {
    if (!form.title.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return false;
    }
    if (form.type === "weekly" && form.dayOfWeek === "") {
      toast({ title: "Error", description: "Select a day of week", variant: "destructive" });
      return false;
    }
    if (form.bonusXp.trim() !== "") {
      const n = parseInt(form.bonusXp.trim(), 10);
      if (Number.isNaN(n)) {
        toast({ title: "Error", description: "Bonus XP must be a whole number", variant: "destructive" });
        return false;
      }
    }
    if (form.type === "monthly") {
      const d = parseInt(form.monthlyDay, 10);
      if (!form.monthlyDay || Number.isNaN(d) || d < 1 || d > 31) {
        toast({
          title: "Error",
          description: "Enter a valid day of month (1–31)",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const buildPayload = () => {
    const linked_monthly_task_id =
      form.type === "daily" && form.isNumericTask && form.linkedMonthlyTaskId
        ? form.linkedMonthlyTaskId
        : null;
    const linked_monthly_periodic_id =
      form.type === "daily" &&
      form.isNumericTask &&
      !form.linkedMonthlyTaskId &&
      form.linkedMonthlyPeriodicId
        ? form.linkedMonthlyPeriodicId
        : null;

    const rawBonus = form.bonusXp.trim();
    const assignment_xp_override: number | null =
      rawBonus === "" ? null : parseInt(rawBonus, 10);

    const payload: Record<string, unknown> = {
      organization_id: organizationId,
      manager_id: managerId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      type: form.type,
      day_of_week: form.type === "weekly" && form.dayOfWeek !== "" ? parseInt(form.dayOfWeek, 10) : null,
      monthly_day:
        form.type === "monthly" && form.monthlyDay !== "" ? parseInt(form.monthlyDay, 10) : null,
      is_numeric_task: form.isNumericTask,
      numeric_unit: form.isNumericTask ? form.numericUnit.trim() || null : null,
      linked_monthly_task_id,
      is_enabled: form.isEnabled,
      assigned_user_ids: form.assignedUserIds.length > 0 ? form.assignedUserIds : null,
      priority: form.priority,
      assignment_xp_override,
    };

    // PostgREST rejects unknown columns: omit null `linked_monthly_periodic_id` on create so DBs
    // that have not applied 20260412100000_periodic_monthly_template_link.sql still work.
    // Edits still send explicit nulls so links can be cleared and stay in sync with the schema.
    if (dialog.mode === "edit" || linked_monthly_periodic_id !== null) {
      payload.linked_monthly_periodic_id = linked_monthly_periodic_id;
    }

    return payload;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (dialog.mode === "create") {
        const { data: inserted, error } = await supabase
          .from("manager_periodic_tasks")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        if (form.isEnabled && inserted?.id) {
          try {
            const res = await fetch("/api/manager/periodic-tasks/materialize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ templateId: inserted.id }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(typeof json?.error === "string" ? json.error : res.statusText);
            }
            const created = typeof json?.taskRowsCreated === "number" ? json.taskRowsCreated : 0;
            toast({
              title: "Success",
              description:
                created > 0
                  ? `Periodic task saved and assigned (${created} task row${created === 1 ? "" : "s"}). Future runs use the cron schedule.`
                  : "Periodic task saved. Nothing to assign for the current period yet (e.g. wrong weekday / not the monthly day); cron will assign when due.",
            });
          } catch (bootErr) {
            const msg = bootErr instanceof Error ? bootErr.message : "Materialize failed";
            toast({
              title: "Saved; instant assign failed",
              description: `${msg} Cron will still assign on schedule.`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Success",
            description: "Periodic task saved. Enable it and use cron to assign on schedule.",
          });
        }
      } else if (dialog.row) {
        const {
          organization_id: _o,
          manager_id: _m,
          ...updates
        } = payload as Record<string, unknown>;
        const { error } = await supabase
          .from("manager_periodic_tasks")
          .update(updates)
          .eq("id", dialog.row.id);
        if (error) throw error;
        toast({ title: "Success", description: "Periodic task updated" });
      }
      closeDialog();
      onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this periodic task? Generated tasks in the past are not removed.")) return;
    try {
      const { error } = await supabase.from("manager_periodic_tasks").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted" });
      onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const toggleEnabled = async (row: ManagerPeriodicTask, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("manager_periodic_tasks")
        .update({ is_enabled: enabled })
        .eq("id", row.id);
      if (error) throw error;
      onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const matchesPeriodicNameSearch = (t: ManagerPeriodicTask) => {
    const q = periodicTaskNameSearch.trim().toLowerCase();
    if (!q) return true;
    return (t.title || "").toLowerCase().includes(q);
  };

  return (
    <>
      <Tabs
        value={periodicSubTab}
        onValueChange={(v) => onPeriodicSubTabChange(v as "daily" | "weekly" | "monthly")}
        className="space-y-4"
      >
        <div className="flex w-full flex-wrap items-center gap-3">
          <TabsList className="h-auto shrink-0">
            <TabsTrigger value="daily">
              Daily ({periodicTasks.filter((t) => t.type === "daily").length})
            </TabsTrigger>
            <TabsTrigger value="weekly">
              Weekly ({periodicTasks.filter((t) => t.type === "weekly").length})
            </TabsTrigger>
            <TabsTrigger value="monthly">
              Monthly ({periodicTasks.filter((t) => t.type === "monthly").length})
            </TabsTrigger>
          </TabsList>
          <Input
            placeholder="Search by task name..."
            value={periodicTaskNameSearch}
            onChange={(e) => setPeriodicTaskNameSearch(e.target.value)}
            className="min-w-[160px] flex-1 max-w-md"
          />
        </div>

        {(["daily", "weekly", "monthly"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {(() => {
              const rowsForTab = periodicTasks.filter((t) => t.type === tab).filter(matchesPeriodicNameSearch);
              if (rowsForTab.length === 0) {
                const hasAnyOfType = periodicTasks.some((t) => t.type === tab);
                return (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      {!hasAnyOfType
                        ? `No ${tab} periodic tasks yet.`
                        : "No tasks match this search."}
                    </CardContent>
                  </Card>
                );
              }
              return (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Assigned to</TableHead>
                      <TableHead>Schedule detail</TableHead>
                      <TableHead>Numeric / link</TableHead>
                      <TableHead className="w-[100px]">Enabled</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsForTab.map((row) => {
                        const assignedCount = row.assigned_user_ids?.length ?? 0;
                        const assignedText = assignedCount === 0
                          ? "All direct reports"
                          : assignedCount === 1
                            ? "1 member"
                            : `${assignedCount} members`;
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.title}</TableCell>
                            <TableCell>
                              <PriorityBadge priority={row.priority ?? "medium"} size="sm" />
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                              {row.description || "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className={assignedCount === 0 ? "text-muted-foreground italic" : ""}>
                                {assignedText}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.type === "weekly" && row.day_of_week != null
                                ? dayNames[row.day_of_week]
                                : row.type === "monthly" && row.monthly_day != null
                                  ? `Day ${row.monthly_day} of month`
                                  : "Every day"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.is_numeric_task
                                ? `Yes (${row.numeric_unit || "units"})`
                                : "No"}
                            </TableCell>
                            <TableCell>
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-input h-4 w-4"
                                  checked={row.is_enabled}
                                  onChange={(e) => toggleEnabled(row, e.target.checked)}
                                />
                                <span className="text-sm">{row.is_enabled ? "On" : "Off"}</span>
                              </label>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
              );
            })()}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialog.open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === "create" ? "Create periodic task" : "Edit periodic task"}
            </DialogTitle>
            <DialogDescription>
              One row per selected team member is created on each run when enabled. Leave empty to assign to all direct reports.
              For daily numeric tasks you can link to a fixed monthly task row, or to a monthly periodic template
              (resolved per employee after that monthly row exists for the month).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="pt-title">Name (required)</Label>
              <Input
                id="pt-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt-desc">Description</Label>
              <Textarea
                id="pt-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v: "daily" | "weekly" | "monthly") =>
                  setForm({
                    ...form,
                    type: v,
                    dayOfWeek: "",
                    monthlyDay: "",
                    linkedMonthlyTaskId: "",
                    linkedMonthlyPeriodicId: "",
                  })
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v: TaskPriority) => setForm({ ...form, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-bonus-xp">Bonus XP (optional)</Label>
                <Input
                  id="pt-bonus-xp"
                  inputMode="numeric"
                  placeholder="Empty = priority-based (2 / 5 / 8)"
                  value={form.bonusXp}
                  onChange={(e) => setForm({ ...form, bonusXp: e.target.value })}
                />
              </div>
            </div>

            {form.type === "weekly" && (
              <div className="space-y-2">
                <Label>Day of week</Label>
                <Select
                  value={form.dayOfWeek}
                  onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayNames.map((name, i) => (
                      <SelectItem key={name} value={String(i)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.type === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="pt-monthly-day">Day of month (1–31)</Label>
                <Input
                  id="pt-monthly-day"
                  type="number"
                  min={1}
                  max={31}
                  value={form.monthlyDay}
                  onChange={(e) => setForm({ ...form, monthlyDay: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  On shorter months (e.g. Feb), runs on the last day if needed.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pt-enabled"
                checked={form.isEnabled}
                onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
              />
              <Label htmlFor="pt-enabled" className="cursor-pointer">
                Enabled (automation on)
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Assign to (select one or more, or leave empty for all)</Label>
              <div className="rounded-md border max-h-52 overflow-y-auto p-3 space-y-2 bg-muted/20">
                {assignableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No team members available</p>
                ) : (
                  assignableUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={form.assignedUserIds.includes(u.id)}
                        onChange={() => {
                          setForm((prev) => ({
                            ...prev,
                            assignedUserIds: prev.assignedUserIds.includes(u.id)
                              ? prev.assignedUserIds.filter((id) => id !== u.id)
                              : [...prev.assignedUserIds, u.id],
                          }));
                        }}
                      />
                      <span>
                        {u.full_name} <span className="text-muted-foreground">({u.role})</span>
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
                      setForm((prev) => ({
                        ...prev,
                        assignedUserIds: assignableUsers.map((x) => x.id),
                      }))
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((prev) => ({ ...prev, assignedUserIds: [] }))}
                  >
                    Clear (assign to all)
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Empty selection means this task will be assigned to all direct reports automatically.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pt-numeric"
                checked={form.isNumericTask}
                onChange={(e) =>
                  setForm({
                    ...form,
                    isNumericTask: e.target.checked,
                    ...(!e.target.checked
                      ? { linkedMonthlyTaskId: "", linkedMonthlyPeriodicId: "" }
                      : {}),
                  })
                }
              />
              <Label htmlFor="pt-numeric" className="cursor-pointer">
                Numeric task
              </Label>
            </div>

            {form.isNumericTask && (
              <div className="space-y-2">
                <Label htmlFor="pt-unit">Unit label</Label>
                <Input
                  id="pt-unit"
                  placeholder="e.g. certificates"
                  value={form.numericUnit}
                  onChange={(e) => setForm({ ...form, numericUnit: e.target.value })}
                />
              </div>
            )}

            {form.isNumericTask && form.type === "daily" && (
              <div className="space-y-2">
                <Label>Link to monthly rollup (optional)</Label>
                <Select
                  value={linkedMonthlySelectValue(form)}
                  onValueChange={(v) => {
                    if (v === NO_LINKED_MONTHLY_VALUE) {
                      setForm({ ...form, linkedMonthlyTaskId: "", linkedMonthlyPeriodicId: "" });
                    } else if (v.startsWith("task:")) {
                      setForm({
                        ...form,
                        linkedMonthlyTaskId: v.slice(5),
                        linkedMonthlyPeriodicId: "",
                      });
                    } else if (v.startsWith("periodic:")) {
                      setForm({
                        ...form,
                        linkedMonthlyPeriodicId: v.slice(9),
                        linkedMonthlyTaskId: "",
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Monthly task or template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LINKED_MONTHLY_VALUE}>None</SelectItem>
                    {monthlyNumericLinkOptions.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Monthly task rows</SelectLabel>
                        {monthlyNumericLinkOptions.map((t) => (
                          <SelectItem key={`task:${t.id}`} value={`task:${t.id}`}>
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {monthlyPeriodicLinkOptions.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Monthly periodic templates</SelectLabel>
                        {monthlyPeriodicLinkOptions.map((p) => (
                          <SelectItem key={`periodic:${p.id}`} value={`periodic:${p.id}`}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Task rows work like before. Templates are resolved per employee when the monthly row exists (after
                  its due day in the month).
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-auto pt-2 border-t">
            <Button variant="outline" type="button" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={submitting || !form.title.trim()}>
              {submitting ? "Saving…" : dialog.mode === "create" ? "Create" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
