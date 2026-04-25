"use client";

import { getLevelProgress } from "@/lib/gamification/xp";
import { cn } from "@/lib/utils/cn";

interface PlayerLevelWidgetProps {
  totalXp: number;
  className?: string;
  compact?: boolean;
}

export function PlayerLevelWidget({ totalXp, className, compact }: PlayerLevelWidgetProps) {
  const { level, xpInLevel, xpToNext, totalXp: safe } = getLevelProgress(totalXp);
  const pct = xpToNext > 0 ? Math.min(100, Math.round((xpInLevel / xpToNext) * 100)) : 100;

  if (compact) {
    return (
      <div className={cn("rounded-xl border border-slate-700 bg-slate-800/80 p-3", className)}>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
          <span className="font-semibold text-white">Lv.{level}</span>
          <span className="tabular-nums text-slate-400">
            {safe.toLocaleString()} XP
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Player level</p>
          <p className="text-2xl font-black tracking-tight text-slate-900">Level {level}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Total XP</p>
          <p className="text-lg font-black tabular-nums text-indigo-600">{safe.toLocaleString()}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Next level</span>
          <span className="tabular-nums">
            {xpInLevel.toLocaleString()} / {xpToNext.toLocaleString()} XP
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
