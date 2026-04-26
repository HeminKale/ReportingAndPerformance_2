"use client";

import { useMemo } from "react";
import type { Task, TaskLog } from "@/lib/types/database";

interface TaskWithLog extends Task {
  taskLog?: TaskLog;
}

interface TaskProgressRingsProps {
  tasks: TaskWithLog[];
}

export function TaskProgressRings({ tasks }: TaskProgressRingsProps) {
  const stats = useMemo(() => {
    const total = tasks.length;
    let completed = 0;
    let submitted = 0;
    let approved = 0;

    for (const task of tasks) {
      if (task.taskLog?.status === "completed") {
        completed++;
        submitted++; // If it's completed by employee, it is submitted
        if (task.taskLog?.verification_status === "approved") {
          approved++;
        }
      }
    }

    return { total, completed, submitted, approved };
  }, [tasks]);

  const completionPercent = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const approvalPercent = stats.submitted > 0 ? (stats.approved / stats.submitted) * 100 : 0;

  const getColor = (percent: number) => {
    if (percent < 33.34) return "#ef4444"; // red-500
    if (percent < 66.67) return "#eab308"; // yellow-500
    return "#22c55e"; // green-500
  };

  const Ring = ({ percent, label, fraction }: { percent: number; label: string; fraction: string }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;
    const color = getColor(percent);

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-28 w-28 items-center justify-center">
          {/* Background Ring */}
          <svg className="absolute inset-0 h-full w-full -rotate-90 transform">
            <circle
              cx="56"
              cy="56"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              fill="transparent"
              className="text-slate-100"
            />
            {/* Progress Ring */}
            <circle
              cx="56"
              cy="56"
              r={radius}
              stroke={color}
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-slate-800">{fraction}</span>
          </div>
        </div>
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
    );
  };

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <Ring
        percent={completionPercent}
        fraction={`${stats.completed}/${stats.total}`}
        label="Completed / Total Tasks"
      />
      <Ring
        percent={approvalPercent}
        fraction={`${stats.approved}/${stats.submitted}`}
        label="Approved / Submitted Tasks"
      />
    </div>
  );
}
