"use client";

import { useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { xpRewardForTaskType } from "@/lib/gamification/xp";
import type { Task, TaskLog } from "@/lib/types/database";

interface TaskWithLog extends Task {
  taskLog?: TaskLog;
}

interface TaskTableProps {
  tasks: TaskWithLog[];
  onSubmit: (task: Task) => void;
  onView: (task: Task, taskLog?: TaskLog) => void;
}

export function TaskTable({ tasks, onSubmit, onView }: TaskTableProps) {
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);

  const getStatusBadge = (taskLog?: TaskLog) => {
    if (!taskLog) return <Badge variant="outline" className="border-slate-200">Not submitted</Badge>;

    if (taskLog.verification_status === "pending") {
      return <Badge className="border-0 bg-amber-100 text-amber-900">Pending approval</Badge>;
    }
    if (taskLog.verification_status === "rejected") {
      return <Badge className="border-0 bg-rose-100 text-rose-900">Needs resubmit</Badge>;
    }
    if (taskLog.verification_status === "approved" && taskLog.status === "completed") {
      return <Badge className="border-0 bg-emerald-100 text-emerald-900">Completed</Badge>;
    }
    if (taskLog.status === "pending") {
      return <Badge className="border-0 bg-amber-100 text-amber-900">Pending</Badge>;
    }
    return <Badge className="border-0 bg-indigo-100 text-indigo-900">Logged</Badge>;
  };

  const canSubmitTask = (taskLog?: TaskLog) => {
    if (!taskLog) return true;
    if (taskLog.verification_status === "pending") return false;
    if (taskLog.verification_status === "approved") return false;
    return true;
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-14 text-center text-slate-500">
        No tasks here — you&apos;re all caught up.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task, index) => {
        const taskLog = task.taskLog;
        const canSubmit = canSubmitTask(taskLog);
        const isMenuOpen = openMenuTaskId === task.id;
        const xp = xpRewardForTaskType(task.type);

        return (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            whileHover={{ scale: 1.01, y: -2 }}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-indigo-500 to-violet-500 opacity-80" />
            <div className="flex flex-col gap-4 pl-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-lg bg-slate-100 font-medium capitalize text-slate-700">
                    {task.type}
                  </Badge>
                  {getStatusBadge(taskLog)}
                </div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  {task.title}
                  {task.is_numeric_task && taskLog?.numeric_value != null && (
                    <span className="ml-2 text-sm font-semibold text-indigo-600">
                      ({taskLog.numeric_value} {task.numeric_unit || "units"})
                    </span>
                  )}
                </h3>
                {task.description ? (
                  <p className="line-clamp-2 text-sm text-slate-600">{task.description}</p>
                ) : null}
                <p className="text-xs font-medium text-slate-400">
                  Assigned {format(new Date(task.created_at), "dd MMM yyyy")}
                  {taskLog?.submitted_at ? (
                    <span className="ml-2">
                      · Submitted {format(new Date(taskLog.submitted_at), "HH:mm dd/MM/yyyy")}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
                <div className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-xs font-black text-white shadow-sm">
                  +{xp} XP
                </div>
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-200"
                    onClick={() =>
                      setOpenMenuTaskId((prev) => (prev === task.id ? null : task.id))
                    }
                  >
                    <MoreHorizontal className="mr-1 h-4 w-4" />
                    Actions
                    <ChevronDown className="ml-1 h-4 w-4 opacity-60" />
                  </Button>
                  {isMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {task.is_numeric_task && canSubmit ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start rounded-lg font-medium"
                            onClick={() => {
                              onSubmit(task);
                              setOpenMenuTaskId(null);
                            }}
                          >
                            {taskLog?.verification_status === "rejected" ? "Re-enter number" : "Enter number"}
                          </Button>
                          {taskLog && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start rounded-lg text-slate-600"
                              onClick={() => {
                                onView(task, taskLog);
                                setOpenMenuTaskId(null);
                              }}
                            >
                              View details
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start rounded-lg"
                            onClick={() => {
                              onView(task, taskLog);
                              setOpenMenuTaskId(null);
                            }}
                          >
                            View details
                          </Button>
                          {canSubmit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start rounded-lg font-medium text-indigo-600"
                              onClick={() => {
                                onSubmit(task);
                                setOpenMenuTaskId(null);
                              }}
                            >
                              {taskLog?.verification_status === "rejected" ? "Resubmit task" : "Submit task"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
