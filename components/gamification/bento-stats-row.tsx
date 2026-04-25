"use client";

import { motion } from "framer-motion";
import { Flame, CheckCircle2, Gauge } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface BentoStatsRowProps {
  streak: number;
  tasksCompletedToday: number;
  productivityScore: number;
  productivityLabel: string;
  className?: string;
}

export function BentoStatsRow({
  streak,
  tasksCompletedToday,
  productivityScore,
  productivityLabel,
  className,
}: BentoStatsRowProps) {
  const cards = [
    {
      key: "streak",
      icon: Flame,
      label: "Activity streak",
      value: streak,
      suffix: streak === 1 ? "day" : "days",
      accent: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-500/10 text-amber-600",
    },
    {
      key: "done",
      icon: CheckCircle2,
      label: "Tasks today",
      value: tasksCompletedToday,
      suffix: "done",
      accent: "from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-500/10 text-emerald-600",
    },
    {
      key: "score",
      icon: Gauge,
      label: "Productivity score",
      value: productivityScore,
      suffix: productivityLabel,
      accent: "from-indigo-500 to-violet-500",
      iconBg: "bg-indigo-500/10 text-indigo-600",
    },
  ];

  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      {cards.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div
            className={cn(
              "absolute left-0 top-0 h-full w-1 bg-gradient-to-b",
              c.accent
            )}
          />
          <div className="flex items-start justify-between gap-3 pl-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {c.label}
              </p>
              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                {c.key === "score" ? `${c.value}` : c.value}
                {c.key === "score" ? (
                  <span className="ml-1 text-lg font-bold text-slate-400">/100</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">{c.suffix}</p>
            </div>
            <div className={cn("rounded-xl p-2.5", c.iconBg)}>
              <c.icon className="h-6 w-6" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
