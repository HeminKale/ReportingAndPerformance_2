import { format, subDays } from "date-fns";

/**
 * Consecutive calendar days where the user had at least one approved completed task.
 * If today has no activity yet, streak still counts from yesterday (day not finished).
 */
export function computeApprovedTaskStreak(
  approvedDates: string[],
  anchorDate: Date = new Date()
): number {
  const set = new Set(approvedDates);
  let d = anchorDate;
  if (!set.has(format(d, "yyyy-MM-dd"))) {
    d = subDays(d, 1);
  }
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const key = format(d, "yyyy-MM-dd");
    if (set.has(key)) {
      streak++;
      d = subDays(d, 1);
    } else {
      break;
    }
  }
  return streak;
}
