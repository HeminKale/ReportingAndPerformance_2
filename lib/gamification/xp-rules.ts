/**
 * Central place to tune XP amounts, rank names, and badge copy.
 * Edit values here when product changes — avoid scattering magic numbers.
 */

import type { MistakeSeverity, TaskPriority } from "@/lib/types/database";

/** Clock-in must be at or before this local time (HH:mm) for punctuality XP. */
export const XP_CLOCK_IN_CUTOFF = "09:00";

/** Streak uses org cutoff or this default (HH:mm). */
export const STREAK_CLOCK_IN_CUTOFF_DEFAULT = "09:15";

export const CLOCK_OUT_END = "17:00";

export const XP_PUNCTUALITY_BUNDLE = 5;
export const XP_OFF_WINDOW_CLOCK = -3;

export const MISTAKE_XP: Record<MistakeSeverity, number> = {
  low: -8,
  medium: -15,
  high: -20,
};

export const XP_PENDING_TASK_EACH = -5;
export const XP_ALL_TASKS_COMPLETED_BONUS = 8;

/** When `assignment_xp_override` is null, award this by task priority. */
export const PRIORITY_BASE_XP: Record<TaskPriority, number> = {
  low: 2,
  medium: 5,
  high: 8,
};

export const XP_TRAINING_COMPLETED = 20;
export const XP_ENQUIRY_NEW_CLOSED_WON = 10;
export const XP_ENQUIRY_RENEWAL_CLOSED_WON = 5;

export type RankTier = {
  id: string;
  minXp: number;
  rankName: string;
  badgeName: string;
};

/** Milestones every 250 XP up to 2000; extend `RANK_TIERS` for higher ceilings. */
export const RANK_TIERS: RankTier[] = [
  { id: "t250", minXp: 250, rankName: "Beginner", badgeName: "🌱 Starter" },
  { id: "t500", minXp: 500, rankName: "Explorer", badgeName: "🚀 Go-Getter" },
  { id: "t750", minXp: 750, rankName: "Performer", badgeName: "💼 Achiever" },
  { id: "t1000", minXp: 1000, rankName: "Pro", badgeName: "🧠 Consistent" },
  { id: "t1250", minXp: 1250, rankName: "Expert", badgeName: "⚡ Elite" },
  { id: "t1500", minXp: 1500, rankName: "Master", badgeName: "🔥 Dominator" },
  { id: "t1750", minXp: 1750, rankName: "Champion", badgeName: "🏆 Champion" },
  { id: "t2000", minXp: 2000, rankName: "Legend", badgeName: "👑 Legend" },
];

export function rankForTotalXp(totalXp: number): { rankName: string; nextTier: RankTier | null } {
  let rankName = "Rookie";
  let nextTier: RankTier | null = RANK_TIERS[0] ?? null;
  for (const tier of RANK_TIERS) {
    if (totalXp >= tier.minXp) {
      rankName = tier.rankName;
      nextTier = RANK_TIERS[RANK_TIERS.indexOf(tier) + 1] ?? null;
    }
  }
  return { rankName, nextTier };
}

export function perTaskAssignmentXp(
  priority: TaskPriority,
  assignmentXpOverride: number | null | undefined
): number {
  if (assignmentXpOverride !== null && assignmentXpOverride !== undefined) {
    return assignmentXpOverride;
  }
  return PRIORITY_BASE_XP[priority] ?? PRIORITY_BASE_XP.medium;
}
