"use client";

import { useEffect, useRef, useState } from "react";
import { useDopamine } from "./animation-manager";

interface XpProgressBarProps {
  userId: string;
  totalXp: number;
  nextGoalXp: number;
  xpProgressPct: number;
  nextTierExists: boolean;
  rankName: string;
  nextRankName: string | null;
}

export function XpProgressBar({
  userId,
  totalXp,
  nextGoalXp,
  xpProgressPct,
  nextTierExists,
  rankName,
  nextRankName,
}: XpProgressBarProps) {
  const { triggerXpGain, triggerXpLoss } = useDopamine();

  const [currentXp, setCurrentXp] = useState(totalXp);
  const [isRippling, setIsRippling] = useState(false);
  const [animatedPct, setAnimatedPct] = useState(0);

  // Key is user-scoped so multiple users on the same device don't bleed state.
  const lsKey = `taskos-xp-last-seen-${userId}`;

  // Track whether we've already processed the current totalXp on this mount.
  const processedXpRef = useRef<number | null>(null);

  // On mount + whenever totalXp changes, compare against persisted last-seen.
  useEffect(() => {
    if (processedXpRef.current === totalXp) return;
    processedXpRef.current = totalXp;

    const stored = typeof window !== "undefined" ? localStorage.getItem(lsKey) : null;
    const lastSeen = stored !== null ? parseInt(stored, 10) : null;

    if (lastSeen === null) {
      // First visit on this device — seed without animating to avoid a spurious burst.
      if (typeof window !== "undefined") localStorage.setItem(lsKey, String(totalXp));
    } else if (totalXp > lastSeen) {
      const delta = totalXp - lastSeen;
      triggerXpGain(window.innerWidth / 2, window.innerHeight / 2, delta);
      if (typeof window !== "undefined") localStorage.setItem(lsKey, String(totalXp));
    } else if (totalXp < lastSeen) {
      const delta = lastSeen - totalXp;
      triggerXpLoss(delta, "Penalty");
      if (typeof window !== "undefined") localStorage.setItem(lsKey, String(totalXp));
    }

    setCurrentXp(totalXp);
    // Slight delay so the bar grows visibly after mount.
    setTimeout(() => setAnimatedPct(xpProgressPct), 300);
  }, [totalXp, xpProgressPct, lsKey, triggerXpGain, triggerXpLoss]);

  useEffect(() => {
    const handleRipple = () => {
      setIsRippling(true);
      setTimeout(() => setIsRippling(false), 800);
    };
    window.addEventListener("taskos-xp-ripple", handleRipple);
    return () => window.removeEventListener("taskos-xp-ripple", handleRipple);
  }, []);

  return (
    <div className="mb-8 flex items-center gap-4">
      {/* Current Badge (Left) */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center">
        {rankName !== "Starter" ? (
          <img
            src={`/assets/badges/${rankName}.png`}
            alt={rankName}
            className="h-full w-full object-contain drop-shadow-md"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="h-full w-full" />
        )}
      </div>

      {/* Bar Content (Middle) */}
      <div className="flex-1">
        <div className="mb-2 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          <span>{currentXp} XP</span>
          <span>{nextTierExists ? `${nextGoalXp} XP` : "MAX"}</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-200/50 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] transition-all">
          {isRippling && (
            <div className="pointer-events-none absolute inset-0 z-10 animate-liquid-ripple" />
          )}
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-sm transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative"
            style={{ width: `${animatedPct}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          </div>
        </div>
      </div>

      {/* Next Badge (Right) */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center">
        {nextRankName && (
          <img
            src={`/assets/badges/${nextRankName}_unrevealed.png`}
            alt="Next Rank"
            className="h-full w-full object-contain opacity-40 grayscale"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
      </div>
    </div>
  );
}
