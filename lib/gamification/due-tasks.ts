import { format, getISOWeek, getISOWeekYear, parseISO } from "date-fns";
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

function isMaterializedFromPeriodic(task: Task): boolean {
  return task.source_manager_periodic_task_id != null;
}

/** yyyy-MM-dd interpreted at midday for stable ISO week (aligned with `periodKeyForTemplate` weekly keys). */
function isoWeekYearAndWeekForDateStr(dateStr: string): { wy: number; wk: number } {
  const d = parseISO(`${dateStr}T12:00:00`);
  return { wy: getISOWeekYear(d), wk: getISOWeek(d) };
}

function createdCalendarDaySameISOWeekAs(
  createdAtIso: string,
  clockOutDateStr: string
): boolean {
  const createdDay = format(parseISO(createdAtIso), "yyyy-MM-dd");
  const a = isoWeekYearAndWeekForDateStr(createdDay);
  const b = isoWeekYearAndWeekForDateStr(clockOutDateStr);
  return a.wy === b.wy && a.wk === b.wk;
}

/**
 * Tasks that must be satisfied before clock-out for `dateStr`.
 *
 * **Base rules** (`isTaskDueOnDate`): dailies due every day from assignment onward; weeklies when
 * `day_of_week` matches JS `getDay()` (Sun=0); monthlies when `due_date === dateStr` (exact YYYY-MM-DD).
 *
 * **Manual tasks** (`source_manager_periodic_task_id` null): no extra row filters — a single weekly
 * row stays due every matching weekday; a single daily stays due daily.
 *
 * **Materialized periodic rows** (cron creates new `tasks` rows per period): without narrowing, many
 * historical **daily** / **weekly** rows would still match “due today” and block clock-out. We keep only:
 * - **daily**: row whose `created_at` calendar day equals `dateStr` (today’s instance).
 * - **weekly**: row whose `created_at` falls in the **same ISO week** as `dateStr` (this week’s instance).
 * - **monthly**: unchanged — `due_date === dateStr` already selects at most the row for this calendar
 *   month/day (each materialized month has its own `due_date`).
 */
export function getTasksDueForClockOutOnDate(
  tasks: Task[],
  userId: string,
  dateStr: string,
  weekday: number
): Task[] {
  const base = getTasksDueForUserOnDate(tasks, userId, dateStr, weekday);
  return base.filter((t) => {
    if (!isMaterializedFromPeriodic(t)) return true;

    if (t.type === "daily") {
      const createdDay = format(parseISO(t.created_at), "yyyy-MM-dd");
      return createdDay === dateStr;
    }
    if (t.type === "weekly") {
      return createdCalendarDaySameISOWeekAs(t.created_at, dateStr);
    }
    return true;
  });
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

/** Work submitted on time for clock-out / streak hooks: `status === completed`, not rejected/recalled; manager approval not required (pending is OK). */
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

/** Blocks clock-out until the employee fixes and resubmits after manager reject/recall. */
export function isTaskLogRejectedOrRecalled(log: TaskLog | undefined): boolean {
  if (!log) return false;
  return log.verification_status === "rejected" || log.verification_status === "recalled";
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
