"use client";

import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TaskPriority } from "@/lib/types/database";

const styles: Record<
  TaskPriority,
  { ring: string; text: string; icon: string; dial: string }
> = {
  low: {
    ring: "border-emerald-400/80 bg-emerald-50/90",
    text: "text-emerald-800",
    icon: "text-emerald-600",
    dial: "rotate-[-52deg]",
  },
  medium: {
    ring: "border-amber-400/90 bg-amber-50/90",
    text: "text-amber-900",
    icon: "text-amber-600",
    dial: "rotate-[8deg]",
  },
  high: {
    ring: "border-rose-500/90 bg-rose-50/90",
    text: "text-rose-900",
    icon: "text-rose-600",
    dial: "rotate-[48deg]",
  },
};

export function PriorityBadge({
  priority,
  className,
  size = "md",
}: {
  priority?: TaskPriority | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const p: TaskPriority = priority === "low" || priority === "high" ? priority : "medium";
  const s = styles[p];
  const sm = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-bold uppercase tracking-wide shadow-sm",
        sm ? "text-[10px]" : "text-xs",
        s.ring,
        s.text,
        className
      )}
      title={`${p} priority`}
    >
      <span className={cn("inline-flex origin-center transition-transform", s.dial)} aria-hidden>
        <Gauge className={cn(sm ? "h-3.5 w-3.5" : "h-4 w-4", s.icon)} strokeWidth={2.25} />
      </span>
      {p}
    </span>
  );
}
