import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Task, TaskLog } from "@/lib/types/database";

export type IncompleteKind = "not_submitted" | "pending" | "pending_approval" | "rejected";

export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function taskDueOnDay(task: Task, day: Date): boolean {
  const d = dayKey(day);
  const createdDay = format(parseISO(task.created_at), "yyyy-MM-dd");
  if (d < createdDay) return false;

  if (task.type === "daily") {
    return d === createdDay;
  }
  if (task.type === "weekly") {
    return task.day_of_week !== null && task.day_of_week === day.getDay();
  }
  if (task.type === "monthly") {
    return task.due_date === d;
  }
  return false;
}

export function isApprovedCompletedLog(log: TaskLog | undefined): boolean {
  return !!log && log.status === "completed" && log.verification_status === "approved";
}

export function getIncompleteKind(log: TaskLog | undefined): IncompleteKind {
  if (!log) return "not_submitted";
  if (log.verification_status === "rejected") return "rejected";
  if (log.status === "pending") return "pending";
  // Caller excludes approved completions via isApprovedCompletedLog.
  if (log.status === "completed") return "pending_approval";
  return "pending";
}

export const INCOMPLETE_LABELS: Record<IncompleteKind, string> = {
  not_submitted: "Not submitted",
  pending: "Pending",
  pending_approval: "Pending approval",
  rejected: "Rejected",
};

export function incompleteStripeLabel(kindPerTask: IncompleteKind[]): string {
  if (kindPerTask.length === 0) return "";
  const unique = [...new Set(kindPerTask)];
  if (unique.length === 1) {
    return `${INCOMPLETE_LABELS[unique[0]]}: ${kindPerTask.length}`;
  }
  return `Incomplete: ${kindPerTask.length}`;
}

export function localHM(iso: string, timezone: string): string {
  return formatInTimeZone(parseISO(iso), timezone, "HH:mm");
}

/** true if local clock-in time is strictly after cutoff (default 09:15). */
export function isClockInLate(
  clockInIso: string,
  timezone: string,
  cutoff: string = "09:15"
): boolean {
  return localHM(clockInIso, timezone) > cutoff;
}

/** true if local clock-out is strictly before end of workday (default 17:00). */
export function isClockOutBeforeEnd(
  clockOutIso: string,
  timezone: string,
  dayEnd: string = "17:00"
): boolean {
  return localHM(clockOutIso, timezone) < dayEnd;
}

export function logMapKey(taskId: string, dateStr: string): string {
  return `${taskId}|${dateStr}`;
}
