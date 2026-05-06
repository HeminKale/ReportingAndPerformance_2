import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MISTAKE_XP,
  XP_ALL_TASKS_COMPLETED_BONUS,
  XP_ENQUIRY_NEW_CLOSED_WON,
  XP_ENQUIRY_RENEWAL_CLOSED_WON,
  XP_TRAINING_COMPLETED,
  perTaskAssignmentXp,
} from "@/lib/gamification/xp-rules";
import type { TaskPriority } from "@/lib/types/database";
import { bumpUserTotalXp, insertXpLedgerRow } from "@/lib/gamification/ledger";

export async function applyMistakeXp(
  admin: SupabaseClient,
  mistakeId: string
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const { data: m, error } = await admin.from("mistakes").select("*").eq("id", mistakeId).maybeSingle();
  if (error || !m) return { ok: false, error: error?.message ?? "not_found" };
  const delta = MISTAKE_XP[m.severity as keyof typeof MISTAKE_XP] ?? MISTAKE_XP.medium;
  const ins = await insertXpLedgerRow(admin, {
    user_id: m.user_id,
    organization_id: m.organization_id,
    delta,
    reason: `Mistake logged (${m.severity})`,
    source_type: "mistake",
    source_id: mistakeId,
    metadata: { severity: m.severity, date: m.date },
  });
  if (!ins.ok) {
    if (ins.duplicate) return { ok: true, duplicate: true };
    return { ok: false, error: ins.message };
  }
  await bumpUserTotalXp(admin, m.user_id, m.organization_id, delta);
  return { ok: true };
}

export async function applyTrainingCompletedXp(
  admin: SupabaseClient,
  trainingId: string
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const { data: t, error } = await admin.from("trainings").select("*").eq("id", trainingId).maybeSingle();
  if (error || !t) return { ok: false, error: error?.message ?? "not_found" };
  if (t.status !== "completed") return { ok: false, error: "not_completed" };
  const ins = await insertXpLedgerRow(admin, {
    user_id: t.user_id,
    organization_id: t.organization_id,
    delta: XP_TRAINING_COMPLETED,
    reason: "Training completed",
    source_type: "training_completed",
    source_id: trainingId,
    metadata: { name: t.name },
  });
  if (!ins.ok) {
    if (ins.duplicate) return { ok: true, duplicate: true };
    return { ok: false, error: ins.message };
  }
  await bumpUserTotalXp(admin, t.user_id, t.organization_id, XP_TRAINING_COMPLETED);
  return { ok: true };
}

/**
 * Called immediately when a manager approves a task log.
 * Writes one ledger row per task_log (idempotent via source_type + source_id).
 * Also awards the "Complete today's tasks" bonus (+3) when every task **assigned on this log's
 * calendar day** is completed and manager-approved — same scope as the dashboard quest (not all
 * recurring tasks due that day).
 *
 * Reject / recall: does NOT reverse XP (task work was done; only mistakes deduct XP).
 */
export async function applyTaskLogApprovedXp(
  admin: SupabaseClient,
  taskLogId: string
): Promise<{ ok: boolean; duplicate?: boolean; allTasksDone?: boolean; error?: string }> {
  const { data: log, error: logErr } = await admin
    .from("task_logs")
    .select("*, tasks(*)")
    .eq("id", taskLogId)
    .maybeSingle();

  if (logErr || !log) return { ok: false, error: logErr?.message ?? "task_log_not_found" };
  if (log.verification_status !== "approved") return { ok: false, error: "task_not_approved" };
  if (log.status !== "completed") return { ok: false, error: "task_not_completed" };

  const task = log.tasks as { priority?: string; assignment_xp_override?: number | null; organization_id: string } | null;
  if (!task) return { ok: false, error: "task_not_found" };

  const priority = (task.priority ?? "medium") as TaskPriority;
  const delta = perTaskAssignmentXp(priority, task.assignment_xp_override ?? null);

  const ins = await insertXpLedgerRow(admin, {
    user_id: log.user_id,
    organization_id: log.organization_id,
    delta,
    reason: `Task approved`,
    source_type: "task_log_approved",
    source_id: taskLogId,
    metadata: { task_id: log.task_id, date: log.date, priority },
  });

  if (!ins.ok) {
    if (ins.duplicate) return { ok: true, duplicate: true };
    return { ok: false, error: ins.message };
  }

  await bumpUserTotalXp(admin, log.user_id, log.organization_id, delta);

  // Bonus (+3): same task set as dashboard "Complete today's tasks" + each log approved.
  const dateStr = log.date as string;
  const userId = log.user_id as string;

  const { data: allTasks } = await admin
    .from("tasks")
    .select("id, type, day_of_week, due_date, is_common_task, assigned_to, is_active, created_at")
    .eq("organization_id", log.organization_id)
    .or(`assigned_to.eq.${userId},is_common_task.eq.true`)
    .eq("is_active", true);

  const { data: allLogs } = await admin
    .from("task_logs")
    .select("task_id, status, verification_status, submitted_at, updated_at, created_at")
    .eq("user_id", userId)
    .eq("date", dateStr);

  const taskList = (allTasks ?? []) as Array<{
    id: string; type: string; day_of_week: number | null; due_date: string | null;
    is_common_task: boolean; assigned_to: string | null; is_active: boolean; created_at: string;
  }>;

  const { format: fmtFn, parseISO: pISO } = await import("date-fns");

  // Match dashboard "Complete today's tasks": tasks whose assignment date (created_at day)
  // equals the task_log calendar date — not every recurring task due that day.
  const questTasksAssignedOnDate = taskList.filter((t) => {
    const appliesToUser = t.is_common_task || t.assigned_to === userId;
    if (!appliesToUser) return false;
    const createdDay = fmtFn(pISO(t.created_at), "yyyy-MM-dd");
    return createdDay === dateStr;
  });

  if (questTasksAssignedOnDate.length === 0) return { ok: true, allTasksDone: false };

  const logMap = new Map<string, { status: string; verification_status: string }>();
  const sortedDayLogs = [...(allLogs ?? [])].sort(
    (a, b) =>
      new Date(b.submitted_at || b.updated_at || b.created_at).getTime() -
      new Date(a.submitted_at || a.updated_at || a.created_at).getTime()
  );
  for (const l of sortedDayLogs) {
    if (!logMap.has(l.task_id)) logMap.set(l.task_id, l);
  }

  const allQuestDoneApproved = questTasksAssignedOnDate.every((t) => {
    const l = logMap.get(t.id);
    return (
      l &&
      l.status === "completed" &&
      l.verification_status === "approved"
    );
  });

  if (!allQuestDoneApproved) return { ok: true, allTasksDone: false };

  const bonusSourceId = `${userId}_${dateStr}`;
  const bonusIns = await insertXpLedgerRow(admin, {
    user_id: userId,
    organization_id: log.organization_id,
    delta: XP_ALL_TASKS_COMPLETED_BONUS,
    reason: "Complete today's tasks (all assigned today approved)",
    source_type: "all_tasks_day_bonus",
    source_id: bonusSourceId,
    metadata: { date: dateStr, task_count: questTasksAssignedOnDate.length },
  });

  if (bonusIns.ok) {
    await bumpUserTotalXp(admin, userId, log.organization_id, XP_ALL_TASKS_COMPLETED_BONUS);
    return { ok: true, allTasksDone: true };
  }

  // duplicate bonus is fine — another approval already granted it
  return { ok: true, allTasksDone: bonusIns.duplicate };
}

export async function applyEnquiryClosedWonXp(
  admin: SupabaseClient,
  enquiryId: string
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const { data: e, error } = await admin.from("enquiries").select("*").eq("id", enquiryId).maybeSingle();
  if (error || !e) return { ok: false, error: error?.message ?? "not_found" };
  if (e.status !== "closed_won") return { ok: false, error: "not_closed_won" };
  const delta = e.type === "renewal" ? XP_ENQUIRY_RENEWAL_CLOSED_WON : XP_ENQUIRY_NEW_CLOSED_WON;
  const ins = await insertXpLedgerRow(admin, {
    user_id: e.owner_id,
    organization_id: e.organization_id,
    delta,
    reason: e.type === "renewal" ? "Renewal enquiry closed won" : "New enquiry closed won",
    source_type: "enquiry_closed_won",
    source_id: enquiryId,
    metadata: { type: e.type, name: e.name },
  });
  if (!ins.ok) {
    if (ins.duplicate) return { ok: true, duplicate: true };
    return { ok: false, error: ins.message };
  }
  await bumpUserTotalXp(admin, e.owner_id, e.organization_id, delta);
  return { ok: true };
}
