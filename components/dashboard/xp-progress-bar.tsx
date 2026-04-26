"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface XpProgressBarProps {
  totalXp: number;
  nextGoalXp: number;
  xpProgressPct: number;
  nextTierExists: boolean;
}

export function XpProgressBar({ totalXp, nextGoalXp, xpProgressPct, nextTierExists }: XpProgressBarProps) {
  const [isRippling, setIsRippling] = useState(false);
  const [animatedPct, setAnimatedPct] = useState(xpProgressPct);

  useEffect(() => {
    // Initial mount growth animation
    const timer = setTimeout(() => {
      setAnimatedPct(xpProgressPct);
    }, 500);

    const handleRipple = (e: CustomEvent<{ amount: number }>) => {
      setIsRippling(true);
      setTimeout(() => setIsRippling(false), 600);
    };

    window.addEventListener("taskos-xp-ripple", handleRipple as EventListener);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("taskos-xp-ripple", handleRipple as EventListener);
    };
  }, [xpProgressPct]);

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
        <span>{totalXp} XP</span>
        <span className="text-blue-600">{nextTierExists ? nextGoalXp : totalXp} XP</span>
      </div>
      <div 
        className={cn(
          "h-2.5 overflow-hidden rounded-full bg-slate-200/50 shadow-inner transition-all",
          isRippling && "animate-liquid-ripple"
        )}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-sm transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative"
          style={{ width: `${animatedPct}%` }}
        >
          {/* Inner Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        </div>
      </div>
    </div>
  );
}
