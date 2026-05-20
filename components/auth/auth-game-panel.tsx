"use client";

import { useEffect, useRef, useState } from "react";

/* ─── floating particle ────────────────────────────────────────── */
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  drift: number;
  opacity: number;
}

const PARTICLE_COLORS = [
  "#818cf8", "#a78bfa", "#f472b6", "#34d399",
  "#fbbf24", "#60a5fa", "#c084fc",
];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function makeParticle(id: number): Particle {
  return {
    id,
    x: Math.random() * 100,
    y: 110,
    size: randomBetween(4, 12),
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    speed: randomBetween(0.3, 0.9),
    drift: randomBetween(-0.15, 0.15),
    opacity: randomBetween(0.5, 1),
  };
}

/* ─── rank tiers ───────────────────────────────────────────────── */
const RANKS = [
  { name: "Beginner",  minXp: 0,    color: "#94a3b8", emoji: "🌱" },
  { name: "Explorer",  minXp: 250,  color: "#60a5fa", emoji: "🧭" },
  { name: "Performer", minXp: 500,  color: "#a78bfa", emoji: "💼" },
  { name: "Pro",       minXp: 750,  color: "#f472b6", emoji: "🧠" },
  { name: "Expert",    minXp: 1000, color: "#34d399", emoji: "⚡" },
  { name: "Master",    minXp: 1250, color: "#fbbf24", emoji: "🔥" },
  { name: "Legend",    minXp: 1500, color: "#f97316", emoji: "👑" },
];

/* ─── stats that cycle ─────────────────────────────────────────── */
const STATS = [
  { label: "Tasks Done Today",  value: "8 / 10",   color: "#818cf8" },
  { label: "Current Streak",    value: "14 days",  color: "#34d399" },
  { label: "Team Rank",         value: "#2",        color: "#fbbf24" },
  { label: "XP Earned",         value: "+340 XP",  color: "#f472b6" },
  { label: "On-Time Clock-ins", value: "22 / 22",  color: "#60a5fa" },
];

/* ─── component ────────────────────────────────────────────────── */
export function AuthGamePanel() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [xp, setXp]               = useState(0);
  const [rankIdx, setRankIdx]      = useState(0);
  const [statIdx, setStatIdx]      = useState(0);
  const [pulse, setPulse]          = useState(false);
  const nextId = useRef(0);

  const MAX_XP = 1500;

  /* Animate XP bar */
  useEffect(() => {
    const interval = setInterval(() => {
      setXp((prev) => {
        const next = prev + 8;
        if (next >= MAX_XP) {
          setRankIdx((r) => (r + 1 < RANKS.length ? r + 1 : 0));
          setPulse(true);
          setTimeout(() => setPulse(false), 700);
          return 0;
        }
        if (RANKS.some((r) => r.minXp === next || (next > r.minXp && next - 8 < r.minXp))) {
          setRankIdx(RANKS.findLastIndex((r) => r.minXp <= next));
        }
        return next;
      });
    }, 60);
    return () => clearInterval(interval);
  }, []);

  /* Cycle stats */
  useEffect(() => {
    const interval = setInterval(() => {
      setStatIdx((s) => (s + 1) % STATS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  /* Spawn + float particles */
  useEffect(() => {
    const spawn = setInterval(() => {
      setParticles((prev) => {
        const alive = prev
          .map((p) => ({ ...p, y: p.y - p.speed, x: p.x + p.drift }))
          .filter((p) => p.y > -10);
        if (alive.length < 28) {
          alive.push(makeParticle(nextId.current++));
        }
        return alive;
      });
    }, 60);
    return () => clearInterval(spawn);
  }, []);

  const rank     = RANKS[rankIdx] ?? RANKS[0];
  const nextRank = RANKS[rankIdx + 1];
  const pct      = nextRank ? Math.min(100, Math.round((xp / nextRank.minXp) * 100)) : 100;
  const stat     = STATS[statIdx];

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        minHeight: "100vh",
      }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width:   `${randomBetween(1, 2.5)}px`,
              height:  `${randomBetween(1, 2.5)}px`,
              left:    `${(i * 17.3) % 100}%`,
              top:     `${(i * 11.7) % 100}%`,
              opacity: randomBetween(0.15, 0.6),
              animation: `twinkle ${randomBetween(2, 5)}s ease-in-out ${randomBetween(0, 4)}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left:            `${p.x}%`,
              bottom:          `${Math.max(0, p.y)}%`,
              width:           `${p.size}px`,
              height:          `${p.size}px`,
              background:      p.color,
              opacity:         p.opacity * (p.y / 100),
              boxShadow:       `0 0 ${p.size * 2}px ${p.color}`,
              transition:      "none",
              transform:       "translateZ(0)",
            }}
          />
        ))}
      </div>

      {/* Main card */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-10 w-full max-w-sm">

        {/* Logo + brand */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-white text-3xl font-black shadow-2xl"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            W
          </div>
          <p className="text-white/60 text-sm font-medium tracking-widest uppercase">
            Worksphere
          </p>
        </div>

        {/* Rank badge */}
        <div
          className="flex flex-col items-center gap-2 transition-all duration-500"
          style={{
            transform: pulse ? "scale(1.12)" : "scale(1)",
          }}
        >
          <span className="text-6xl">{rank.emoji}</span>
          <span
            className="text-2xl font-black tracking-tight"
            style={{ color: rank.color, textShadow: `0 0 24px ${rank.color}` }}
          >
            {rank.name}
          </span>
          <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">
            Current Rank
          </span>
        </div>

        {/* XP bar */}
        <div className="w-full">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span style={{ color: rank.color }}>{xp} XP</span>
            <span className="text-white/40">
              {nextRank ? `${nextRank.minXp} XP` : "MAX"}
            </span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width:      `${pct}%`,
                background: `linear-gradient(90deg, #6366f1, ${rank.color})`,
                boxShadow:  `0 0 12px ${rank.color}88`,
              }}
            />
          </div>
          {nextRank && (
            <p className="mt-1.5 text-center text-xs text-white/30">
              Next: <span style={{ color: RANKS[rankIdx + 1]?.color }}>{nextRank.name}</span>
            </p>
          )}
        </div>

        {/* Cycling stat card */}
        <div
          className="w-full rounded-2xl px-6 py-4 text-center"
          style={{
            background:    "rgba(255,255,255,0.06)",
            border:        "1px solid rgba(255,255,255,0.1)",
            backdropFilter:"blur(12px)",
          }}
          key={statIdx}
        >
          <p
            className="text-2xl font-black"
            style={{ color: stat.color, textShadow: `0 0 16px ${stat.color}` }}
          >
            {stat.value}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/40">
            {stat.label}
          </p>
        </div>

        {/* Rank ladder */}
        <div className="w-full flex items-center justify-between gap-1">
          {RANKS.slice(0, 7).map((r, i) => (
            <div key={r.name} className="flex flex-col items-center gap-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl text-base transition-all duration-300"
                style={{
                  background:  i <= rankIdx ? `${r.color}22` : "rgba(255,255,255,0.04)",
                  border:      `1.5px solid ${i <= rankIdx ? r.color : "rgba(255,255,255,0.08)"}`,
                  boxShadow:   i === rankIdx ? `0 0 14px ${r.color}88` : "none",
                  transform:   i === rankIdx ? "scale(1.15)" : "scale(1)",
                }}
              >
                <span style={{ filter: i > rankIdx ? "grayscale(1) opacity(0.4)" : "none" }}>
                  {r.emoji}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Tagline */}
        <p className="text-center text-white/30 text-xs leading-relaxed">
          Complete tasks · Earn XP · Climb ranks<br />
          Every day is a new chance to lead the board
        </p>
      </div>

      {/* Keyframes injected inline */}
      <style>{`
        @keyframes twinkle {
          from { opacity: 0.1; }
          to   { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
