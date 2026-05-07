import type { SupabaseClient } from "@supabase/supabase-js";
import { RANK_TIERS } from "@/lib/gamification/xp-rules";

export type EarnedBadge = { id: string; badgeName: string; minXp: number; earnedAt: string };

export async function insertXpLedgerRow(
  admin: SupabaseClient,
  row: {
    user_id: string;
    organization_id: string;
    delta: number;
    reason: string;
    source_type: string;
    source_id: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ ok: true } | { ok: false; duplicate: boolean; message?: string }> {
  const { error } = await admin.from("xp_ledger").insert({
    user_id: row.user_id,
    organization_id: row.organization_id,
    delta: row.delta,
    reason: row.reason,
    source_type: row.source_type,
    source_id: row.source_id,
    metadata: row.metadata ?? {},
  });
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, duplicate: true };
  return { ok: false, duplicate: false, message: error.message };
}

/** Removes one ledger row by unique (user_id, source_type, source_id); returns the row's delta for reversing totals. */
export async function deleteXpLedgerRowBySource(
  admin: SupabaseClient,
  userId: string,
  sourceType: string,
  sourceId: string
): Promise<{ deleted: boolean; delta: number }> {
  const sid = String(sourceId);
  const { data, error } = await admin
    .from("xp_ledger")
    .delete()
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .eq("source_id", sid)
    .select("delta");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return { deleted: false, delta: 0 };
  const delta = rows[0]?.delta ?? 0;
  return { deleted: true, delta };
}

function mergeEarnedBadges(
  existing: unknown,
  totalXp: number,
  earnedAtIso: string
): EarnedBadge[] {
  const prev: EarnedBadge[] = Array.isArray(existing)
    ? (existing as EarnedBadge[]).filter((b) => b && typeof b.id === "string")
    : [];
  const ids = new Set(prev.map((b) => b.id));
  const next = [...prev];
  for (const tier of RANK_TIERS) {
    if (totalXp >= tier.minXp && !ids.has(tier.id)) {
      next.push({
        id: tier.id,
        badgeName: tier.badgeName,
        minXp: tier.minXp,
        earnedAt: earnedAtIso,
      });
      ids.add(tier.id);
    }
  }
  return next;
}

export async function bumpUserTotalXp(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
  delta: number
): Promise<void> {
  if (delta === 0) return;
  const { data: row } = await admin.from("user_gamification").select("*").eq("user_id", userId).maybeSingle();
  const now = new Date().toISOString();
  if (!row) {
    const total_xp = delta;
    const earned_badges = mergeEarnedBadges([], total_xp, now);
    const { error } = await admin.from("user_gamification").insert({
      user_id: userId,
      organization_id: organizationId,
      total_xp,
      current_streak: 0,
      longest_streak: 0,
      earned_badges,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const total_xp = (row.total_xp ?? 0) + delta;
  const earned_badges = mergeEarnedBadges(row.earned_badges, total_xp, now);
  const { error } = await admin
    .from("user_gamification")
    .update({
      total_xp,
      earned_badges,
      updated_at: now,
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
