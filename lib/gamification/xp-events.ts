import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import {
  MISTAKE_XP,
  XP_ALL_TASKS_COMPLETED_BONUS,
  XP_ENQUIRY_NEW_CLOSED_WON,
  XP_ENQUIRY_RENEWAL_CLOSED_WON,
  XP_TRAINING_COMPLETED,
  perTaskAssignmentXp,
} from "@/lib/gamification/xp-rules";
import { bumpUserTotalXp, deleteXpLedgerRowBySource, insertXpLedgerRow } from "@/lib/gamification/ledger";
import type { TaskPriority } from "@/lib/types/database";

type QuestTaskRow = {
  id: string;
  created_at: string;
  is_common_task: boolean;
  assigned_to: string | null;
};

/** Dashboard quest scope: tasks assigned (created) on `dateStr` for this user — same as “Complete today’s tasks”. */
export function filterQuestTasksAssignedOnDate(
  tasks: QuestTaskRow[],
  userId: string,
  dateStr: string
): QuestTaskRow[] {
  return tasks.filter((t) => {
    const appliesToUser = t.is_common_task || t.assigned_to === userId;
    if (!appliesToUser) return false;
    const createdDay = format(parseISO(t.created_at), "yyyy-MM-dd");
    return createdDay === dateStr;
  });
}

function latestLogRowByTaskId(
  logs: Array<{
    task_id: string;
    status: string;
    verification_status: string;
    submitted_at: string | null;
    updated_at: string | null;
    created_at: string;
  }>
): Map<string, { status: string; verification_status: string }> {
  const logMap = new Map<string, { status: string; verification_status: string }>();
  const sorted = [...logs].sort(
    (a, b) =>
      new Date(b.submitted_at || b.updated_at || b.created_at).getTime() -
      new Date(a.submitted_at || a.updated_at || a.created_at).getTime()
  );
  for (const l of sorted) {
    if (!logMap.has(l.task_id)) logMap.set(l.task_id, l);
  }
  return logMap;
}

function allQuestTasksApprovedForBonus(
  questTasks: QuestTaskRow[],
  logMap: Map<string, { status: string; verification_status: string }>
): boolean {
  if (questTasks.length === 0) return false;
  return questTasks.every((t) => {
    const l = logMap.get(t.id);
    return l && l.status === "completed" && l.verification_status === "approved";
  });
}

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

export async function reconcileAllTasksDayBonusForDate(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
  dateStr: string
): Promise<{ bonusRemoved: boolean }> {
  const { data: allTasks } = await admin
    .from("tasks")
    .select("id, created_at, is_common_task, assigned_to, is_active")
    .eq("organization_id", organizationId)
    .or(`assigned_to.eq.${userId},is_common_task.eq.true`)
    .eq("is_active", true);

  const questTasks = filterQuestTasksAssignedOnDate((allTasks ?? []) as QuestTaskRow[], userId, dateStr);

  const { data: allLogs } = await admin
    .from("task_logs")
    .select("task_id, status, verification_status, submitted_at, updated_at, created_at")
    .eq("user_id", userId)
    .eq("date", dateStr);

  const logMap = latestLogRowByTaskId(allLogs ?? []);
  const allDone = allQuestTasksApprovedForBonus(questTasks, logMap);

  const bonusSourceId = `${userId}_${dateStr}`;
  if (allDone) {
    return { bonusRemoved: false };
  }

  const removed = await deleteXpLedgerRowBySource(admin, userId, "all_tasks_day_bonus", bonusSourceId);
  if (removed.deleted && removed.delta !== 0) {
    await bumpUserTotalXp(admin, userId, organizationId, -removed.delta);
    return { bonusRemoved: true };
  }
  return { bonusRemoved: false };
}

/**
 * Removes per-task approval XP (ledger row `task_log_approved`) and reconciles the +3 “all tasks
 * assigned today approved” bonus when recall/reject breaks that condition. Idempotent if no approval
 * row exists (e.g. reject from pending).
 *
 * Re-approve after recall inserts `task_log_approved` again — duplicate guard only applies while the
 * row still exists; we delete it here so a later approval can grant XP again.
 */
export async function revokeTaskLogApprovalXp(
  admin: SupabaseClient,
  taskLogId: string
): Promise<{ ok: boolean; taskXpRemoved?: boolean; bonusRemoved?: boolean; error?: string }> {
  const { data: log, error } = await admin
    .from("task_logs")
    .select("user_id, organization_id, date")
    .eq("id", taskLogId)
    .maybeSingle();
  if (error || !log) return { ok: false, error: error?.message ?? "task_log_not_found" };

  const sid = String(taskLogId);
  const removed = await deleteXpLedgerRowBySource(admin, log.user_id, "task_log_approved", sid);
  if (removed.deleted && removed.delta !== 0) {
    await bumpUserTotalXp(admin, log.user_id, log.organization_id, -removed.delta);
  }

  const { bonusRemoved } = await reconcileAllTasksDayBonusForDate(
    admin,
    log.user_id,
    log.organization_id,
    log.date as string
  );

  return {
    ok: true,
    taskXpRemoved: removed.deleted,
    bonusRemoved,
  };
}

/**
 * Called immediately when a manager approves a task log.
 * Writes one ledger row per task_log (idempotent via source_type + source_id).
 * Also awards the "Complete today's tasks" bonus (+3) when every task **assigned on this log's
 * calendar day** is completed and manager-approved — same scope as the dashboard quest (not all
 * recurring tasks due that day).
 *
 * Recall/reject XP removal is handled by `revokeTaskLogApprovalXp` (triggered from the client when
 * the manager recalls or rejects).
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
    source_id: String(taskLogId),
    metadata: { task_id: log.task_id, date: log.date, priority },
  });

  if (!ins.ok) {
    if (ins.duplicate) return { ok: true, duplicate: true };
    return { ok: false, error: ins.message };
  }

  await bumpUserTotalXp(admin, log.user_id, log.organization_id, delta);

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

  const taskList = (allTasks ?? []) as QuestTaskRow[];

  const questTasksAssignedOnDate = filterQuestTasksAssignedOnDate(taskList, userId, dateStr);

  if (questTasksAssignedOnDate.length === 0) return { ok: true, allTasksDone: false };

  const logMap = latestLogRowByTaskId(allLogs ?? []);

  const allQuestDoneApproved = allQuestTasksApprovedForBonus(questTasksAssignedOnDate, logMap);

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
