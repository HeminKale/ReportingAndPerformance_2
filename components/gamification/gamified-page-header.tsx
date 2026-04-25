"use client";

import { motion } from "framer-motion";
import { PlayerLevelWidget } from "@/components/gamification/player-level-widget";
import { greetingForHour } from "@/lib/gamification/xp";
import { cn } from "@/lib/utils/cn";

interface GamifiedPageHeaderProps {
  firstName: string;
  totalXp: number;
  title: string;
  subtitle?: string;
  /** Hour 0–23 in the user's context (e.g. org local) — defaults to browser local */
  hour?: number;
  className?: string;
}

export function GamifiedPageHeader({
  firstName,
  totalXp,
  title,
  subtitle,
  hour,
  className,
}: GamifiedPageHeaderProps) {
  const h = hour ?? new Date().getHours();
  const period = greetingForHour(h);

  return (
    <div className={cn("mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between", className)}>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="text-sm font-medium text-indigo-600">
          Good {period}, {firstName || "there"}!
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-xl text-slate-600">{subtitle}</p>
        ) : null}
      </motion.div>
      <div className="w-full shrink-0 lg:max-w-sm">
        <PlayerLevelWidget totalXp={totalXp} />
      </div>
    </div>
  );
}
