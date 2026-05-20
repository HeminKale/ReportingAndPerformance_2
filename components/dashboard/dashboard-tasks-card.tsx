"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollableCardList } from "@/components/dashboard/scrollable-card-list";
import { TaskListItem } from "@/components/dashboard/task-list-item";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskLog } from "@/lib/types/database";

interface DashboardTasksCardProps {
  tasksAssignedToday: Task[];
  taskLogsToday: TaskLog[];
  pastDueTasks: Task[];
  pastTaskLogs: TaskLog[];
}

function getDotColor(log: TaskLog | undefined): string {
  const isApproved = log?.verification_status === "approved";
  const isCompleted = log?.status === "completed";
  const isSubmitted = isCompleted && log?.verification_status === "pending";

  if (isApproved) return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
  if (isSubmitted) return "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]";
  return "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]";
}

const BRAND = "#000435";

export function DashboardTasksCard({
  tasksAssignedToday,
  taskLogsToday,
  pastDueTasks,
  pastTaskLogs,
}: DashboardTasksCardProps) {
  const [activeTab, setActiveTab] = useState<"today" | "pastDue">("today");

  return (
    <Card className="rounded-[2.5rem] border-white/40 shadow-xl bg-white/70 backdrop-blur-md">
      <CardHeader className="px-8 pt-8 pb-0">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold" style={{ color: BRAND }}>
            Tasks
          </h2>
          {/* Tab controls */}
          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={() => setActiveTab("today")}
              className={cn(
                "px-4 py-2 text-sm font-semibold transition-colors border-b-2",
                activeTab === "today"
                  ? "border-b-2 text-[#000435]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
              style={activeTab === "today" ? { borderColor: BRAND, color: BRAND } : {}}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pastDue")}
              className={cn(
                "px-4 py-2 text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5",
                activeTab === "pastDue"
                  ? "border-b-2 text-[#000435]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
              style={activeTab === "pastDue" ? { borderColor: BRAND, color: BRAND } : {}}
            >
              Past due
              {pastDueTasks.length > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-100 px-1 text-[10px] font-bold text-rose-700">
                  {pastDueTasks.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-8 pb-8 pt-4">
        {activeTab === "today" ? (
          tasksAssignedToday.length > 0 ? (
            <ScrollableCardList maxHeight="400px">
              {tasksAssignedToday.map((task) => {
                const log = taskLogsToday.find((l) => l.task_id === task.id);
                return (
                  <TaskListItem key={task.id} task={task} log={log} dotColor={getDotColor(log)} />
                );
              })}
            </ScrollableCardList>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <p className="text-sm font-medium text-slate-500">No tasks assigned today. Enjoy the day!</p>
            </div>
          )
        ) : (
          pastDueTasks.length > 0 ? (
            <ScrollableCardList maxHeight="400px">
              {pastDueTasks.map((task) => {
                const latestLog = pastTaskLogs
                  .filter((l) => l.task_id === task.id)
                  .sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime())[0];
                return (
                  <TaskListItem key={task.id} task={task} log={latestLog} dotColor={getDotColor(latestLog)} />
                );
              })}
            </ScrollableCardList>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <p className="text-sm font-medium text-slate-500">No past due items. Great work!</p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
