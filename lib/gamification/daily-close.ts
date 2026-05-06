import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { localHM } from "@/lib/calendar/calendar-utils";
import {
  CLOCK_OUT_END,
  XP_CLOCK_IN_CUTOFF,
  XP_OFF_WINDOW_CLOCK,
  XP_PUNCTUALITY_BUNDLE,
  XP_PENDING_TASK_EACH,
  XP_ZERO_MISTAKES_BONUS,
} from "@/lib/gamification/xp-rules";
import {
  evaluateStreakDay,
  parseWeekdayFromDateStr,
  streakClockInCutoffFromOrg,
  type StreakDayContext,
} from "@/lib/gamification/streak-conditions";
import {
  getLogForTaskDate,
  getTasksDueForUserOnDate,
  isApprovedCompletedBefore,
} from "@/lib/gamification/due-tasks";
import { bumpUserTotalXp, insertXpLedgerRow } from "@/lib/gamification/ledger";
import type { Organization, Task, TaskLog } from "@/lib/types/database";

export type DailyCloseInput = {
  userId: string;
  organizationId: string;
  attendanceId: string;
  dateStr: string;
  timezone: string;
  clockInTime: string;
  clockOutTime: string;
};


export async function ensureUserGamificationRow(
  admin: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<void> {
  const { data } = await admin.from("user_gamification").select("user_id").eq("user_id", userId).maybeSingle();
  if (data) return;
  await admin.from("user_gamification").insert({
    user_id: userId,
    organization_id: organizationId,
    total_xp: 0,
    current_streak: 0,
    longest_streak: 0,
    earned_badges: [],
  });
}

/**
 * Runs after a successful clock-out. Idempotent per user+calendar date (`daily_close` ledger row).
 */
export async function runDailyGamificationClose(
  admin: SupabaseClient,
  input: DailyCloseInput
): Promise<{
  skipped: boolean;
  duplicate?: boolean;
  streakOk?: boolean;
  xpDelta?: number;
  error?: string;
}> {
  const { userId, organizationId, dateStr, timezone, clockInTime, clockOutTime } = input;
  const sourceId = dateStr;

  const { data: existing } = await admin
    .from("xp_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("source_type", "daily_close")
    .eq("source_id", sourceId)
    .maybeSingle();
  if (existing) {
    return { skipped: true, duplicate: true };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();
  const settings = (org?.settings ?? null) as Organization["settings"] | null;
  const streakCutoff = streakClockInCutoffFromOrg(settings);

  const [{ data: tasks }, { data: taskLogs }, { data: mistakes }, { data: leaves }] = await Promise.all([
    admin
      .from("tasks")
      .select("*")
      .eq("organization_id", organizationId)
      .or(`assigned_to.eq.${userId},is_common_task.eq.true`)
      .eq("is_active", true),
    admin.from("task_logs").select("*").eq("user_id", userId).eq("date", dateStr),
    admin.from("mistakes").select("id,date").eq("user_id", userId).eq("date", dateStr),
    admin
      .from("leaves")
      .select("start_date,end_date,type,status")
      .eq("user_id", userId)
      .eq("status", "approved"),
  ]);

  const taskList = (tasks ?? []) as Task[];
  const logs = (taskLogs ?? []) as TaskLog[];
  const weekday = parseWeekdayFromDateStr(dateStr);

  const streakCtx: StreakDayContext = {
    dateStr,
    weekday,
    timezone,
    clockInCutoff: streakCutoff,
    attendance: {
      user_id: userId,
      organization_id: organizationId,
      date: dateStr,
      clock_in_time: clockInTime,
      clock_out_time: clockOutTime,
    },
    mistakesOnDay: mistakes ?? [],
    leavesApproved: leaves ?? [],
    tasks: taskList,
    taskLogs: logs,
    userId,
  };

  const { ok: streakOk } = evaluateStreakDay(streakCtx);

  const inOk = localHM(clockInTime, timezone) <= XP_CLOCK_IN_CUTOFF;
  const outOk = localHM(clockOutTime, timezone) >= CLOCK_OUT_END;
  const punctualityXp = inOk && outOk ? XP_PUNCTUALITY_BUNDLE : XP_OFF_WINDOW_CLOCK;

  // Pending penalty: deducted at clock-out for tasks still not completed.
  // Per-task and all-tasks-bonus XP is awarded incrementally on manager approval — not here.
  const due = getTasksDueForUserOnDate(taskList, userId, dateStr, weekday);
  let pendingCount = 0;
  for (const t of due) {
    const log = getLogForTaskDate(logs, t.id, userId, dateStr);
    if (!isApprovedCompletedBefore(log, clockOutTime)) pendingCount++;
  }
  const pendingXp = XP_PENDING_TASK_EACH * pendingCount;

  const zeroMistakesXp = (mistakes?.length ?? 0) === 0 ? XP_ZERO_MISTAKES_BONUS : 0;

  const totalXp = punctualityXp + pendingXp + zeroMistakesXp;

  const meta = {
    punctualityXp,
    pendingCount,
    pendingXp,
    zeroMistakesXp,
    streakOk,
  };

  const ins = await insertXpLedgerRow(admin, {
    user_id: userId,
    organization_id: organizationId,
    delta: totalXp,
    reason: "Daily performance (punctuality, tasks, streak context)",
    source_type: "daily_close",
    source_id: sourceId,
    metadata: meta,
  });
  if (!ins.ok) {
    if (ins.duplicate) return { skipped: true, duplicate: true };
    return { skipped: true, error: ins.message ?? "daily_close_insert_failed" };
  }

  if (totalXp !== 0) {
    await bumpUserTotalXp(admin, userId, organizationId, totalXp);
  } else {
    await ensureUserGamificationRow(admin, userId, organizationId);
  }

  const { data: gRow } = await admin.from("user_gamification").select("*").eq("user_id", userId).maybeSingle();
  const currentStreak = gRow?.current_streak ?? 0;
  const longestStreak = gRow?.longest_streak ?? 0;
  const prevQual = (gRow?.last_streak_qualifying_date as string | null) ?? null;

  let newStreak = 0;
  let newLastQual: string | null = prevQual;
  if (streakOk) {
    if (prevQual === dateStr) {
      newStreak = currentStreak;
      newLastQual = prevQual;
    } else if (!prevQual) {
      newStreak = 1;
      newLastQual = dateStr;
    } else {
      const gap = differenceInCalendarDays(parseISO(dateStr), parseISO(prevQual));
      if (gap === 1) {
        newStreak = currentStreak + 1;
        newLastQual = dateStr;
      } else if (gap === 0) {
        newStreak = currentStreak;
        newLastQual = prevQual;
      } else {
        newStreak = 1;
        newLastQual = dateStr;
      }
    }
  } else {
    newStreak = 0;
    newLastQual = null;
  }

  const newLongest = Math.max(longestStreak, newStreak);

  const { error: upG } = await admin
    .from("user_gamification")
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_streak_qualifying_date: newLastQual,
      last_streak_eval_date: dateStr,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (upG) {
    return { skipped: false, streakOk, xpDelta: totalXp, error: upG.message };
  }

  return { skipped: false, streakOk, xpDelta: totalXp };
}
