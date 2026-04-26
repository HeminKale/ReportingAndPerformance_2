import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MISTAKE_XP,
  XP_ENQUIRY_NEW_CLOSED_WON,
  XP_ENQUIRY_RENEWAL_CLOSED_WON,
  XP_TRAINING_COMPLETED,
} from "@/lib/gamification/xp-rules";
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
