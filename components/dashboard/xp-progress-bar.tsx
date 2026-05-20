"use client";

import { useEffect, useRef, useState } from "react";
import { useDopamine } from "./animation-manager";
import {
  BadgeImage,
  badgeAssetSrc,
  unrevealedBadgeAssetSrc,
} from "./badge-image";
import { cn } from "@/lib/utils/cn";

const XP_BADGE_RAIL_MIN = 250;

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

  const showBadgeRail = totalXp >= XP_BADGE_RAIL_MIN;

  const lsKey = `worksphere-xp-last-seen-${userId}`;
  const processedXpRef = useRef<number | null>(null);

  useEffect(() => {
    if (processedXpRef.current === totalXp) return;
    processedXpRef.current = totalXp;

    const stored = typeof window !== "undefined" ? localStorage.getItem(lsKey) : null;
    const lastSeen = stored !== null ? parseInt(stored, 10) : null;

    if (lastSeen === null) {
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
    setTimeout(() => setAnimatedPct(xpProgressPct), 300);
  }, [totalXp, xpProgressPct, lsKey, triggerXpGain, triggerXpLoss]);

  useEffect(() => {
    const handleRipple = () => {
      setIsRippling(true);
      setTimeout(() => setIsRippling(false), 800);
    };
    window.addEventListener("worksphere-xp-ripple", handleRipple);
    return () => window.removeEventListener("worksphere-xp-ripple", handleRipple);
  }, []);

  return (
    <div
      className={cn(
        "mb-8 flex items-center",
        showBadgeRail ? "gap-3 sm:gap-4" : "gap-0"
      )}
    >
      {showBadgeRail && (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]">
          {rankName !== "Starter" && (
            <BadgeImage
              src={badgeAssetSrc(rankName)}
              alt={rankName}
              className="h-full w-full drop-shadow-lg"
            />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          <span>{currentXp} XP</span>
          <span>{nextTierExists ? `${nextGoalXp} XP` : "MAX"}</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-200/50 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] transition-all">
          {isRippling && (
            <div className="pointer-events-none absolute inset-0 z-10 animate-liquid-ripple" />
          )}
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-sm transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{ width: `${animatedPct}%` }}
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
        </div>
        {showBadgeRail && nextRankName && (
          <p className="mt-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Next: {nextRankName}
          </p>
        )}
      </div>

      {showBadgeRail && nextRankName && (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]">
          <div
            className="flex h-full w-full items-center justify-center rounded-2xl bg-white/60 p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/70"
            title={`Unlock at ${nextGoalXp} XP`}
          >
            <BadgeImage
              src={unrevealedBadgeAssetSrc(nextRankName)}
              alt={`Next rank: ${nextRankName}`}
              className="h-full w-full opacity-55 grayscale-[35%]"
              fallbackSrc={
                nextRankName === "Beginner"
                  ? "/assets/badges/Beginner__unrevealed.png"
                  : `/assets/badges/${nextRankName}_unrevealed.png`
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
