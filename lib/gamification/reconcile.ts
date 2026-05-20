import type { SupabaseClient } from "@supabase/supabase-js";
import { format, subDays } from "date-fns";
import { runDailyGamificationClose } from "@/lib/gamification/daily-close";

/**
 * Backfill `daily_close` ledger rows for users who clocked out but never ran gamification
 * (e.g. before deploy). Scans recent calendar dates on `attendance.date`.
 */
export async function reconcileMissingDailyCloses(
  admin: SupabaseClient,
  options: { lookbackDays?: number } = {}
): Promise<{ processed: number; applied: number; streakResets: number; errors: string[] }> {
  const lookback = options.lookbackDays ?? 3;
  const errors: string[] = [];
  let processed = 0;
  let applied = 0;
  let streakResets = 0;
  const today = new Date();

  for (let i = 1; i <= lookback; i++) {
    const dateStr = format(subDays(today, i), "yyyy-MM-dd");
    const { data: rows, error } = await admin
      .from("attendance")
      .select("id,user_id,organization_id,date,clock_in_time,clock_out_time")
      .eq("date", dateStr)
      .not("clock_out_time", "is", null);

    if (error) {
      errors.push(`${dateStr}: ${error.message}`);
      continue;
    }

    for (const att of rows || []) {
      processed++;
      const { data: led } = await admin
        .from("xp_ledger")
        .select("id")
        .eq("user_id", att.user_id)
        .eq("source_type", "daily_close")
        .eq("source_id", att.date)
        .maybeSingle();
      if (led) continue;

      const { data: profile } = await admin.from("users").select("timezone").eq("id", att.user_id).maybeSingle();
      const timezone = profile?.timezone || "UTC";
      if (!att.clock_in_time) continue;

      try {
        const r = await runDailyGamificationClose(admin, {
          userId: att.user_id,
          organizationId: att.organization_id,
          attendanceId: att.id,
          dateStr: att.date,
          timezone,
          clockInTime: att.clock_in_time,
          clockOutTime: att.clock_out_time!,
        });
        if (!r.skipped && !r.error) applied++;
      } catch (e) {
        errors.push(`${att.user_id} ${att.date}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");
  const { data: streakRows, error: streakErr } = await admin
    .from("user_gamification")
    .select("user_id,current_streak,last_streak_eval_date")
    .gt("current_streak", 0);

  if (streakErr) {
    errors.push(`streak-reset-scan: ${streakErr.message}`);
  } else {
    for (const row of streakRows || []) {
      const lastEval = row.last_streak_eval_date as string | null;
      if (!lastEval || lastEval < yesterdayStr) {
        const { error: resetErr } = await admin
          .from("user_gamification")
          .update({
            current_streak: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", row.user_id);
        if (resetErr) {
          errors.push(`streak-reset-${row.user_id}: ${resetErr.message}`);
        } else {
          streakResets++;
        }
      }
    }
  }

  return { processed, applied, streakResets, errors };
}
