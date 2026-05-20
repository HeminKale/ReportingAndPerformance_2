/**
 * Pluggable streak rules. Add/remove entries in `STREAK_CONDITION_REGISTRY`.
 * All registered conditions must pass for the day to count toward streak.
 */

import { parseISO } from "date-fns";
import type { Attendance, Leave, Mistake, Task, TaskLog } from "@/lib/types/database";
import { STREAK_CLOCK_IN_CUTOFF_DEFAULT, CLOCK_OUT_END } from "@/lib/gamification/xp-rules";
import { localHM, isClockOutBeforeEnd } from "@/lib/calendar/calendar-utils";
import {
  allDueTasksApprovedCompletedBefore,
  getTasksDueForUserOnDate,
} from "@/lib/gamification/due-tasks";

export type StreakDayContext = {
  dateStr: string;
  weekday: number;
  timezone: string;
  clockInCutoff: string;
  attendance: Pick<
    Attendance,
    "clock_in_time" | "clock_out_time" | "date" | "user_id" | "organization_id"
  > | null;
  mistakesOnDay: Pick<Mistake, "id" | "date">[];
  leavesApproved: Pick<Leave, "start_date" | "end_date" | "type" | "status">[];
  tasks: Task[];
  taskLogs: TaskLog[];
  userId: string;
};

export type StreakCondition = {
  id: string;
  label: string;
  check: (ctx: StreakDayContext) => boolean;
};

function hasFullDayApprovedLeave(ctx: StreakDayContext): boolean {
  const d = ctx.dateStr;
  return ctx.leavesApproved.some(
    (l) =>
      l.status === "approved" &&
      l.type === "full_day" &&
      l.start_date <= d &&
      l.end_date >= d
  );
}

function clockInOnTime(ctx: StreakDayContext): boolean {
  const t = ctx.attendance?.clock_in_time;
  if (!t) return false;
  return localHM(t, ctx.timezone) <= ctx.clockInCutoff;
}

function clockOutOnTime(ctx: StreakDayContext): boolean {
  const t = ctx.attendance?.clock_out_time;
  if (!t) return false;
  return !isClockOutBeforeEnd(t, ctx.timezone, CLOCK_OUT_END);
}

function noMistakes(ctx: StreakDayContext): boolean {
  return ctx.mistakesOnDay.length === 0;
}

function allDueTasksDoneBeforeClockOut(ctx: StreakDayContext): boolean {
  const out = ctx.attendance?.clock_out_time;
  if (!out) return false;
  const due = getTasksDueForUserOnDate(ctx.tasks, ctx.userId, ctx.dateStr, ctx.weekday);
  return allDueTasksApprovedCompletedBefore(due, ctx.taskLogs, ctx.userId, ctx.dateStr, out);
}

function notFullDayLeave(ctx: StreakDayContext): boolean {
  return !hasFullDayApprovedLeave(ctx);
}

/**
 * Half-day leave does not auto-fail; task + clock conditions still apply.
 * (No separate predicate — absence of auto-fail is the behavior.)
 */
export const STREAK_CONDITION_REGISTRY: StreakCondition[] = [
  { id: "clock_in_on_time", label: "Clock in on or before cutoff", check: clockInOnTime },
  { id: "clock_out_on_time", label: "Clock out on or after 17:00", check: clockOutOnTime },
  { id: "no_mistakes_on_day", label: "Zero mistakes that day", check: noMistakes },
  {
    id: "all_due_tasks_done_before_clock_out",
    label: "All due tasks completed before clock-out",
    check: allDueTasksDoneBeforeClockOut,
  },
  { id: "not_full_day_leave", label: "No full-day approved leave", check: notFullDayLeave },
];

export function evaluateStreakDay(ctx: StreakDayContext): {
  ok: boolean;
  failed: { id: string; label: string }[];
} {
  const failed: { id: string; label: string }[] = [];
  for (const cond of STREAK_CONDITION_REGISTRY) {
    if (!cond.check(ctx)) {
      failed.push({ id: cond.id, label: cond.label });
    }
  }
  return { ok: failed.length === 0, failed };
}

export function parseWeekdayFromDateStr(dateStr: string): number {
  return parseISO(`${dateStr}T12:00:00`).getDay();
}

export function streakClockInCutoffFromOrg(settings: { clock_in_cutoff?: string } | null): string {
  const raw = settings?.clock_in_cutoff;
  if (typeof raw === "string" && /^\d{2}:\d{2}$/.test(raw)) return raw;
  return STREAK_CLOCK_IN_CUTOFF_DEFAULT;
}
