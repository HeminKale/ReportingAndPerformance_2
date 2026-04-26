"use client";

import { useEffect, useState } from "react";
import { useDopamine } from "./animation-manager";
import { Trophy, Star } from "lucide-react";

export function MonthlyCelebration({ 
  isTopPerformer, 
  month 
}: { 
  isTopPerformer: boolean; 
  month: string 
}) {
  const { triggerLevelUp } = useDopamine();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isTopPerformer && month) {
      const key = `celebration-seen-${month}`;
      const seen = localStorage.getItem(key);
      if (!seen) {
        setShow(true);
        triggerLevelUp("Member", "Top Performer of the Month!");
        localStorage.setItem(key, "true");
        
        // Custom celebration flourish
        const interval = setInterval(() => {
          window.dispatchEvent(new CustomEvent("taskos-xp-ripple", { detail: { amount: 100 } }));
        }, 500);
        
        setTimeout(() => {
          clearInterval(interval);
          setShow(false);
        }, 5000);
      }
    }
  }, [isTopPerformer, month]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center bg-yellow-400/10 backdrop-blur-md animate-in fade-in duration-1000">
      <div className="text-center animate-in zoom-in duration-700">
        <div className="relative inline-block">
          <Trophy className="h-32 w-32 text-yellow-500 animate-bounce" />
          <Star className="absolute -top-4 -right-4 h-12 w-12 text-amber-400 animate-spin" />
          <Star className="absolute -bottom-4 -left-4 h-12 w-12 text-amber-400 animate-spin" />
        </div>
        <h1 className="mt-8 text-6xl font-black text-yellow-600 drop-shadow-xl">
          CONGRATULATIONS!
        </h1>
        <p className="mt-4 text-2xl font-bold text-slate-800">
          You are the #1 Performer for {new Date(month + "-01").toLocaleString('default', { month: 'long', year: 'numeric' })}!
        </p>
      </div>
    </div>
  );
}
