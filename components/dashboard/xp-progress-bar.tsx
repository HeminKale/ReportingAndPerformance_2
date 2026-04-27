"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useDopamine } from "./animation-manager";

interface XpProgressBarProps {
  totalXp: number;
  nextGoalXp: number;
  xpProgressPct: number;
  nextTierExists: boolean;
  rankName: string;
  nextRankName: string | null;
}

export function XpProgressBar({ 
  totalXp, 
  nextGoalXp, 
  xpProgressPct, 
  nextTierExists,
  rankName,
  nextRankName
}: XpProgressBarProps) {
  const { triggerXpGain, triggerXpLoss } = useDopamine();

  // Use local state to allow visual incrementing
  const [currentXp, setCurrentXp] = useState(totalXp);
  const [isRippling, setIsRippling] = useState(false);
  const [animatedPct, setAnimatedPct] = useState(xpProgressPct);

  // Hook to track previous values
  const prevXpRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    prevXpRef.current = totalXp;
  }, [totalXp]);

  // Handle XP changes from server
  useEffect(() => {
    const prevXp = prevXpRef.current;
    
    if (prevXp !== undefined && totalXp !== prevXp) {
      const delta = totalXp - prevXp;
      
      if (delta > 0) {
        // Trigger gain animation from center
        triggerXpGain(window.innerWidth / 2, window.innerHeight / 2, delta);
      } else if (delta < 0) {
        // Trigger loss animation
        triggerXpLoss(Math.abs(delta), "Penalty");
      }
    }
    
    // Always sync with the server value
    setCurrentXp(totalXp);
    setAnimatedPct(xpProgressPct);
  }, [totalXp, xpProgressPct, triggerXpGain, triggerXpLoss]);

  useEffect(() => {
    // Initial mount growth animation
    const timer = setTimeout(() => {
      setAnimatedPct(xpProgressPct);
    }, 500);

    const handleRipple = (e: CustomEvent<{ amount: number }>) => {
      setIsRippling(true);
      
      // Only handle the visual ripple effect here, actual state comes from props
      setTimeout(() => setIsRippling(false), 800);
    };

    window.addEventListener("taskos-xp-ripple", handleRipple as EventListener);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("taskos-xp-ripple", handleRipple as EventListener);
    };
  }, [xpProgressPct, nextTierExists, nextGoalXp]);

  return (
    <div className="mb-8 flex items-center gap-4">
      {/* Current Badge (Left) */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center">
        {rankName !== "Starter" ? (
          <img 
            src={`/assets/badges/${rankName}.png`} 
            alt={rankName} 
            className="h-full w-full object-contain drop-shadow-md"
            onError={(e) => (e.currentTarget.style.display = 'none')}
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
          {/* ---- Ripple overlay – animated independently to avoid flicker ---- */}
          {isRippling && (
            <div className="pointer-events-none absolute inset-0 z-10 animate-liquid-ripple" />
          )}
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-sm transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative"
            style={{ width: `${animatedPct}%` }}
          >
            {/* Inner Shimmer effect */}
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
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
      </div>
    </div>
  );
}
