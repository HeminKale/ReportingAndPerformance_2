"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface MotivationWidgetProps {
  headline: string;
  subtext: string;
}

export function MotivationWidget({ headline, subtext }: MotivationWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white shadow-lg"
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="rounded-xl bg-white/15 p-2">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100">Daily boost</p>
          <p className="mt-1 text-lg font-bold leading-snug">{headline}</p>
          <p className="mt-2 text-sm text-indigo-100/90">{subtext}</p>
        </div>
      </div>
    </motion.div>
  );
}
