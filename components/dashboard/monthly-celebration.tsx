"use client";

import { useEffect, useState } from "react";
import { useDopamine } from "./animation-manager";
import { Trophy, Star } from "lucide-react";

export function MonthlyCelebration({ 
  isTopPerformer, 
  month,
  celebrationSeenAt,
  leaderboardId
}: { 
  isTopPerformer: boolean; 
  month: string;
  celebrationSeenAt: string | null;
  leaderboardId?: string;
}) {
  const { triggerLevelUp } = useDopamine();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Use a local storage key as a fallback in case the database update fails or is slow
    const localSeenKey = `celebration-seen-${leaderboardId}`;
    const hasSeenLocally = typeof window !== 'undefined' && localStorage.getItem(localSeenKey);

    // Only show if top performer AND they haven't seen it yet for this month (DB or locally)
    if (isTopPerformer && month && !celebrationSeenAt && leaderboardId && !hasSeenLocally) {
      setShow(true);
      triggerLevelUp("Member", "Top Performer of the Month!");
      
      // Immediately set local storage to prevent double-firing on hot reload or fast navigation
      if (typeof window !== 'undefined') {
        localStorage.setItem(localSeenKey, 'true');
      }

      // Mark as seen in database
      const markAsSeen = async () => {
        try {
          const res = await fetch("/api/leaderboard/celebration-seen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leaderboardId }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.error("Failed to mark celebration as seen", data?.error || res.statusText);
          }
        } catch (e) {
          console.error("Failed to mark celebration as seen", e);
        }
      };
      
      markAsSeen();
      
      // Custom celebration flourish
      const interval = setInterval(() => {
        window.dispatchEvent(new CustomEvent("worksphere-xp-ripple", { detail: { amount: 100 } }));
      }, 500);
      
      setTimeout(() => {
        clearInterval(interval);
        setShow(false);
      }, 5000);
    }
  }, [isTopPerformer, month, celebrationSeenAt, leaderboardId]);

  if (!show) return null;

  // Robust date parsing for "YYYY-MM" or "YYYY-MM-DD"
  const dateObj = new Date(month.includes('-') && month.split('-').length === 2 ? month + "-01" : month);
  const formattedDate = isNaN(dateObj.getTime()) 
    ? "the Month" 
    : dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

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
          You are the #1 Performer for {formattedDate}!
        </p>
      </div>
    </div>
  );
}
