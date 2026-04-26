"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  speed: number;
  angle: number;
  spinSpeed: number;
}

const COLORS = [
  "#f43f5e", // rose-500
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
];

export function Celebration({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) return;

    // Generate confetti pieces
    const newPieces: ConfettiPiece[] = Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 20, // Start near the center horizontally (40% to 60%)
      y: 100, // Start at the bottom of the screen
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      // Velocity components
      speed: Math.random() * 15 + 10,
      angle: (Math.random() * 60 + 240) * (Math.PI / 180), // Angle between 240 and 300 degrees (upwards)
      spinSpeed: (Math.random() - 0.5) * 20,
    }));

    setPieces(newPieces);

    const startTime = Date.now();
    let animationFrameId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      setPieces((prevPieces) => 
        prevPieces.map((p) => {
          // Add gravity effect
          const gravity = elapsed * 0.005;
          const vx = Math.cos(p.angle) * p.speed;
          const vy = Math.sin(p.angle) * p.speed + gravity;
          
          return {
            ...p,
            x: p.x + vx * 0.1,
            y: p.y + vy * 0.2,
            rotation: p.rotation + p.spinSpeed,
          };
        })
      );

      if (elapsed < 3500) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setPieces([]);
        if (onComplete) onComplete();
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [active, onComplete]);

  if (!mounted || pieces.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            opacity: p.y > 110 ? 0 : 1, // Fade out when falling below screen
            transition: 'opacity 0.2s',
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center animate-xp-pop">
        <div className="rounded-2xl bg-white/90 backdrop-blur-md px-8 py-6 shadow-2xl border border-slate-200/50 text-center scale-0 animate-[xp-pop_0.5s_ease-out_forwards]">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-600 mb-2">
            Awesome!
          </h2>
          <p className="text-slate-600 font-medium">You completed all your tasks for today.</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
