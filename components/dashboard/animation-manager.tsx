"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { Sparkles, Trophy } from "lucide-react";

type AnimationContextType = {
  triggerXpGain: (sourceX: number, sourceY: number, amount: number) => void;
  triggerLevelUp: (oldRank: string, newRank: string) => void;
  triggerXpLoss: (amount: number, message: string) => void;
};

const AnimationContext = createContext<AnimationContextType | null>(null);

export function useDopamine() {
  const context = useContext(AnimationContext);
  if (!context) throw new Error("useDopamine must be used within AnimationManager");
  return context;
}

export function AnimationManager({ children }: { children: React.ReactNode }) {
  const [particles, setParticles] = useState<{ id: string; x: number; y: number; amount: number }[]>([]);
  const [levelUp, setLevelUp] = useState<{ active: boolean; old: string; new: string }>({ active: false, old: "", new: "" });
  const [ghosts, setGhosts] = useState<{ id: string; msg: string; amount: number }[]>([]);

  // Entrance Animation
  useEffect(() => {
    // Only run once on mount
    const timer = setTimeout(() => {
      triggerXpGain(window.innerWidth / 2, window.innerHeight / 2, 0); // Intro flourish
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const triggerXpGain = useCallback((x: number, y: number, amount: number) => {
    const id = Math.random().toString(36).substring(7);
    setParticles((p) => [...p, { id, x, y, amount }]);
    setTimeout(() => {
      setParticles((p) => p.filter((part) => part.id !== id));
      // Dispatch event for the XP bar to catch and ripple
      window.dispatchEvent(new CustomEvent("taskos-xp-ripple", { detail: { amount } }));
    }, 800); // matches animation duration
  }, []);

  const triggerLevelUp = useCallback((oldRank: string, newRank: string) => {
    setLevelUp({ active: true, old: oldRank, new: newRank });
    setTimeout(() => {
      setLevelUp({ active: false, old: "", new: "" });
    }, 3000); // 3 seconds of glory
  }, []);

  const triggerXpLoss = useCallback((amount: number, message: string) => {
    const id = Math.random().toString(36).substring(7);
    setGhosts((g) => [...g, { id, msg: message, amount }]);
    setTimeout(() => {
      setGhosts((g) => g.filter((ghost) => ghost.id !== id));
    }, 2000);
  }, []);

  return (
    <AnimationContext.Provider value={{ triggerXpGain, triggerLevelUp, triggerXpLoss }}>
      {children}

      {/* --- Overlay Animations --- */}
      
      {/* 1. Celestial Streak (Particles) */}
      {particles.map((p) => {
        // Calculate destination (XP bar top right approx)
        const destX = window.innerWidth * 0.9;
        const destY = 50;
        const dx = destX - p.x;
        const dy = destY - p.y;
        
        return (
          <div
            key={p.id}
            className="pointer-events-none fixed z-50 animate-celestial"
            style={{
              left: p.x,
              top: p.y,
              //@ts-ignore - Passing custom properties to CSS
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              "--dx-half": `${dx / 2 + 100}px`, // arc curve
              "--dy-half": `${dy / 2 - 50}px`,
            }}
          >
            <div className="relative">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)]"
                  style={{
                    width: Math.random() * 8 + 4 + "px",
                    height: Math.random() * 8 + 4 + "px",
                    top: (Math.random() - 0.5) * 40 + "px",
                    left: (Math.random() - 0.5) * 40 + "px",
                    opacity: Math.random() * 0.5 + 0.5,
                  }}
                />
              ))}
              {p.amount > 0 && (
                <div className="absolute -top-6 -left-4 text-amber-500 font-bold text-lg animate-float-up whitespace-nowrap drop-shadow-md">
                  +{p.amount} XP
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 2. Rank Resonance (Level Up) */}
      {levelUp.active && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm bg-white/30 transition-all duration-1000">
          <div className="text-center">
            <Trophy className="mx-auto h-24 w-24 text-amber-500 animate-pulse-glow mb-4" />
            <div className="relative">
              <h1 className="text-4xl font-black text-slate-800 absolute inset-0 animate-[glass-shatter_1s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
                {levelUp.old}
              </h1>
              <h1 className="text-5xl font-black bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 bg-clip-text text-transparent opacity-0 animate-[xp-pop_1s_1s_cubic-bezier(0.34,1.56,0.64,1)_forwards] drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                {levelUp.new}
              </h1>
            </div>
            <p className="mt-4 text-lg font-bold text-slate-600 opacity-0 animate-[float-up-fade_1s_2s_forwards]">
              Level Up!
            </p>
          </div>
        </div>
      )}

      {/* 3. Ghost Fade (XP Loss) */}
      {ghosts.map((g) => (
        <div
          key={g.id}
          className="pointer-events-none fixed z-50 left-1/2 top-1/4 -translate-x-1/2 flex flex-col items-center animate-ghost-evaporate"
        >
          <span className="text-red-500 font-bold text-2xl drop-shadow-md">-{g.amount} XP</span>
          <span className="text-slate-500 text-sm italic">{g.msg}</span>
        </div>
      ))}
      
    </AnimationContext.Provider>
  );
}
