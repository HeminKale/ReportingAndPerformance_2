import { format, parseISO } from "date-fns";
import type { Task, TaskLog } from "@/lib/types/database";

/**
 * Tasks assigned to the user (or common) that are due on `dateStr` in the sense
 * used for attendance / gamification: daily recurs from assignment day; weekly on DOW; monthly on due_date.
 */
export function isTaskDueOnDate(task: Task, dateStr: string, weekday: number): boolean {
  if (!task.is_active) return false;
  const createdDay = format(parseISO(task.created_at), "yyyy-MM-dd");
  if (dateStr < createdDay) return false;

  if (task.type === "daily") {
    return true;
  }
  if (task.type === "weekly") {
    return task.day_of_week !== null && task.day_of_week === weekday;
  }
  if (task.type === "monthly") {
    return task.due_date === dateStr;
  }
  return false;
}

export function taskAppliesToUser(task: Task, userId: string): boolean {
  return task.is_common_task || task.assigned_to === userId;
}

export function getTasksDueForUserOnDate(
  tasks: Task[],
  userId: string,
  dateStr: string,
  weekday: number
): Task[] {
  return tasks.filter(
    (t) => taskAppliesToUser(t, userId) && isTaskDueOnDate(t, dateStr, weekday)
  );
}

/** Log row for this user/task/date (unique in DB; pick latest if multiple). */
export function getLogForTaskDate(
  logs: TaskLog[],
  taskId: string,
  userId: string,
  dateStr: string
): TaskLog | undefined {
  const matches = logs.filter((l) => l.task_id === taskId && l.user_id === userId && l.date === dateStr);
  if (matches.length === 0) return undefined;
  return [...matches].sort(
    (a, b) =>
      new Date(b.submitted_at || b.updated_at || b.created_at).getTime() -
      new Date(a.submitted_at || a.updated_at || a.created_at).getTime()
  )[0];
}

export function isApprovedCompletedBefore(
  log: TaskLog | undefined,
  clockOutIso: string
): boolean {
  if (!log || log.status !== "completed") return false;
  if (log.verification_status === "rejected" || log.verification_status === "recalled") return false;
  const completedAt = log.submitted_at || log.updated_at || log.created_at;
  if (!completedAt) return false;
  return new Date(completedAt).getTime() <= new Date(clockOutIso).getTime();
}

export function countPendingDueTasks(
  dueTasks: Task[],
  logs: TaskLog[],
  userId: string,
  dateStr: string,
  clockOutIso: string
): number {
  let n = 0;
  for (const task of dueTasks) {
    const log = getLogForTaskDate(logs, task.id, userId, dateStr);
    if (!isApprovedCompletedBefore(log, clockOutIso)) n++;
  }
  return n;
}

export function allDueTasksApprovedCompletedBefore(
  dueTasks: Task[],
  logs: TaskLog[],
  userId: string,
  dateStr: string,
  clockOutIso: string
): boolean {
  if (dueTasks.length === 0) return true;
  return dueTasks.every((task) => {
    const log = getLogForTaskDate(logs, task.id, userId, dateStr);
    return isApprovedCompletedBefore(log, clockOutIso);
  });
}
