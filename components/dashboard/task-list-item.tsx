"use client";


import { perTaskAssignmentXp } from "@/lib/gamification/xp-rules";
import type { Task, TaskLog, TaskPriority } from "@/lib/types/database";

export function TaskListItem({
  task,
  log,
  dotColor,
}: {
  task: Task;
  log: TaskLog | null | undefined;
  dotColor: string;
}) {

  const isApproved = log?.verification_status === "approved";

  const priority = (task.priority ?? "medium") as TaskPriority;
  const taskXp = perTaskAssignmentXp(priority, task.assignment_xp_override);



  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm transition-colors hover:border-blue-100 group"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className={`h-3 w-3 flex-shrink-0 rounded-full ${dotColor} transition-transform group-hover:scale-110`}
        />
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-slate-800 transition-colors group-hover:text-blue-600">
            {task.title}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{task.type} Task</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="rounded-full border border-amber-100 bg-amber-50/90 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 shadow-sm">
          +{taskXp} XP
        </span>
        {log && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
              isApproved
                ? "bg-emerald-100 text-emerald-800"
                : log.verification_status === "rejected"
                  ? "bg-red-100 text-red-800"
                  : log.verification_status === "recalled"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {log.verification_status}
          </span>
        )}
      </div>
    </div>
  );
}
