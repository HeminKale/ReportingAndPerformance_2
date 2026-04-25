import type { DailyPerformanceRating, TaskType } from "@/lib/types/database";

/** XP awarded when a task submission is approved (client estimate for display). */
export function xpRewardForTaskType(type: TaskType): number {
  switch (type) {
    case "daily":
      return 25;
    case "weekly":
      return 75;
    case "monthly":
      return 150;
  }
}

export function xpBonusForDailyPerformance(performance: DailyPerformanceRating | null): number {
  if (!performance) return 0;
  switch (performance) {
    case "excellent":
      return 100;
    case "very_good":
      return 75;
    case "good":
      return 50;
    case "average":
      return 20;
    default:
      return 0;
  }
}

/** Map daily rating to 0–100 productivity score for the stats row. */
export function productivityScoreFromRating(
  performance: DailyPerformanceRating | null
): { score: number; label: string } {
  if (!performance) return { score: 0, label: "No rating yet" };
  const map: Record<DailyPerformanceRating, number> = {
    very_poor: 15,
    poor: 35,
    average: 55,
    good: 75,
    very_good: 88,
    excellent: 100,
  };
  const labels: Record<DailyPerformanceRating, string> = {
    very_poor: "Very poor",
    poor: "Poor",
    average: "Average",
    good: "Good",
    very_good: "Very good",
    excellent: "Excellent",
  };
  return { score: map[performance], label: labels[performance] };
}

/**
 * Level curve: each level requires more XP than the last.
 * `totalXp` is typically the monthly leaderboard score (authoritative) or 0.
 */
export function getLevelProgress(totalXp: number): {
  level: number;
  xpInLevel: number;
  xpToNext: number;
  totalXp: number;
} {
  const safe = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let spent = 0;
  let need = 500;
  while (safe >= spent + need) {
    spent += need;
    level += 1;
    need = Math.min(5000, Math.floor(400 + (level - 1) * 120));
  }
  return {
    level,
    xpInLevel: safe - spent,
    xpToNext: need,
    totalXp: safe,
  };
}

export function greetingForHour(hour: number): "Morning" | "Afternoon" | "Evening" {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}
