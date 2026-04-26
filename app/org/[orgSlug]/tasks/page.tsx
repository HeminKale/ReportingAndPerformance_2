"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskLogDialog } from "@/components/tasks/task-log-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { MonthlyNumericSummary } from "@/components/tasks/monthly-numeric-summary";
import { TaskProgressRings } from "@/components/tasks/task-progress-rings";
import { TaskAssignmentPanel } from "@/components/shared/task-assignment-panel";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronDown, Filter, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskLog, User } from "@/lib/types/database";
const TASK_SUB_TAB_LIST = "inline-flex h-auto w-auto flex-wrap items-center justify-start gap-0 rounded-none border-0 bg-transparent p-0";
const TASK_SUB_TAB_TRIGGER = "rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-semibold text-slate-600 shadow-none transition-colors hover:text-slate-900 data-[state=active]:border-slate-900 data-[state=active]:bg-transparent data-[state=active]:text-slate-900 data-[state=active]:shadow-none";



export default function TasksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskLog, setSelectedTaskLog] = useState<TaskLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [addTaskPanelOpen, setAddTaskPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [taskViewMode, setTaskViewMode] = useState<"list" | "board">("list");
  const [taskPeriod, setTaskPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [historyFilters, setHistoryFilters] = useState({
    daily: { date: '', taskName: '' },
    weekly: { date: '', taskName: '' },
    monthly: { date: '', taskName: '' },
  });
  const supabase = createClient();
  const currentMonth = format(new Date(), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  type TaskLifecycleState =
    | 'never_submitted'
    | 'submitted_pending_approval'
    | 'submitted_rejected'
    | 'approved_completed';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', userData?.organization_id)
      .or(`assigned_to.eq.${authUser.id},is_common_task.eq.true`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const taskIds = (tasksData || []).map((task) => task.id);

    const { data: logsData } = taskIds.length > 0
      ? await supabase
          .from('task_logs')
          .select('*')
          .eq('user_id', authUser.id)
          .in('task_id', taskIds)
          .order('created_at', { ascending: false })
      : { data: [] as TaskLog[] };

    setUser(userData);
    setTasks(tasksData || []);
    setTaskLogs(logsData || []);
    setLoading(false);
  };

  const handleSubmit = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  const handleView = (task: Task, taskLog?: TaskLog) => {
    setSelectedTask(task);
    setSelectedTaskLog(taskLog || null);
    setViewDialogOpen(true);
  };

  const taskLogsByTaskId = useMemo(() => {
    const logsMap = new Map<string, TaskLog[]>();
    for (const log of taskLogs) {
      const existing = logsMap.get(log.task_id) || [];
      existing.push(log);
      logsMap.set(log.task_id, existing);
    }
    return logsMap;
  }, [taskLogs]);

  const getLatestLog = (logs: TaskLog[]) => {
    if (logs.length === 0) return null;
    return [...logs].sort((a, b) => {
      const aTime = new Date(a.submitted_at || a.created_at).getTime();
      const bTime = new Date(b.submitted_at || b.created_at).getTime();
      return bTime - aTime;
    })[0];
  };

  const getLifecycleState = (logs: TaskLog[]): TaskLifecycleState => {
    if (logs.length === 0) return 'never_submitted';

    const hasApprovedCompletion = logs.some(
      (log) => log.status === 'completed' && log.verification_status === 'approved'
    );

    if (hasApprovedCompletion) return 'approved_completed';

    const latestLog = getLatestLog(logs);
    if (!latestLog) return 'never_submitted';

    if (latestLog.verification_status === 'pending') {
      return 'submitted_pending_approval';
    }

    if (latestLog.verification_status === 'rejected') {
      return 'submitted_rejected';
    }

    if (latestLog.verification_status === 'recalled') {
      return 'submitted_rejected';
    }

    return 'never_submitted';
  };

  const tasksWithState = useMemo(() => {
    return tasks.map((task) => {
      const logs = taskLogsByTaskId.get(task.id) || [];
      const latestLog = getLatestLog(logs);
      const lifecycleState = getLifecycleState(logs);

      return {
        ...task,
        taskLog: latestLog || undefined,
        lifecycleState,
        logs,
      };
    });
  }, [tasks, taskLogsByTaskId]);

  const selfCreatedTasks = useMemo(() => {
    if (!user) return [] as Task[];
    return tasks.filter((task) => task.assigned_by === user.id);
  }, [tasks, user]);

  // Phase 1 data split:
  // - currentTasks: active/incomplete and pending/rejected states
  // - historyTasks: completed + manager-approved where Assigned At is older than today
  const getAssignedDay = (createdAt: string) => format(new Date(createdAt), "yyyy-MM-dd");

  const groupByAssignedDate = (tasks: any[]): [string, any[]][] => {
    const groups: Record<string, any[]> = {};
    for (const task of tasks) {
      const day = getAssignedDay(task.created_at);
      if (!groups[day]) groups[day] = [];
      groups[day].push(task);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  };

  const applyHistoryFilters = (tasks: any[], freq: 'daily' | 'weekly' | 'monthly') => {
    const { date, taskName } = historyFilters[freq];
    return tasks.filter((t) => {
      const matchDate = !date || getAssignedDay(t.created_at) === date;
      const matchName = !taskName || t.title.toLowerCase().includes(taskName.toLowerCase());
      return matchDate && matchName;
    });
  };

  const currentTasks = tasksWithState.filter(
    (task) =>
      !(
        task.lifecycleState === 'approved_completed' &&
        getAssignedDay(task.created_at) < today
      )
  );
  const historyTasks = tasksWithState.filter(
    (task) =>
      task.lifecycleState === 'approved_completed' &&
      getAssignedDay(task.created_at) < today
  );

  const dailyTasks = currentTasks.filter(t => t.type === 'daily');
  const weeklyTasks = currentTasks.filter(t => t.type === 'weekly');
  const monthlyTasks = currentTasks.filter(t => t.type === 'monthly');

  const isAssignedToday = (task: Task) => getAssignedDay(task.created_at) === today;

  const pieChartTasks = useMemo(() => {
    const currentDayOfWeek = new Date().getDay();
    return currentTasks.filter((task) => {
      if (task.type === "daily") {
        return isAssignedToday(task);
      }
      if (task.type === "weekly") {
        return task.day_of_week === currentDayOfWeek || isAssignedToday(task);
      }
      if (task.type === "monthly") {
        return task.due_date === today || isAssignedToday(task);
      }
      return false;
    });
  }, [currentTasks, today]);

  // Prepared for Phase 2 (Current/History sub-tabs + history accordion).
  const dailyHistoryTasks = historyTasks.filter(t => t.type === 'daily');
  const weeklyHistoryTasks = historyTasks.filter(t => t.type === 'weekly');
  const monthlyHistoryTasks = historyTasks.filter(t => t.type === 'monthly');

  const isPendingApprovalTask = (task: (Task & { taskLog?: TaskLog })) => {
    const log = task.taskLog;
    if (!log) return false;
    return log.status === 'completed' && log.verification_status === 'pending';
  };

  const dailyPendingApprovalTasks = dailyTasks.filter(isPendingApprovalTask);
  const weeklyPendingApprovalTasks = weeklyTasks.filter(isPendingApprovalTask);
  const monthlyPendingApprovalTasks = monthlyTasks.filter(isPendingApprovalTask);

  const dailyFreshTasks = dailyTasks.filter((t) => !isPendingApprovalTask(t));
  const weeklyFreshTasks = weeklyTasks.filter((t) => !isPendingApprovalTask(t));
  const monthlyFreshTasks = monthlyTasks.filter((t) => !isPendingApprovalTask(t));

  const dailyCurrentTodayCount = dailyTasks.filter(isAssignedToday).length;
  const weeklyCurrentTodayCount = weeklyTasks.filter(isAssignedToday).length;
  const monthlyCurrentTodayCount = monthlyTasks.filter(isAssignedToday).length;

  const numericDailyTaskIds = useMemo(
    () =>
      new Set(
        tasks
          .filter((t) => t.type === "daily" && t.is_numeric_task)
          .map((t) => t.id)
      ),
    [tasks]
  );

  // Monthly rollup should only come from daily numeric tasks linked to a monthly task.
  const linkedNumericDailyTaskIds = useMemo(
    () =>
      new Set(
        tasks
          .filter((t) => t.type === "daily" && t.is_numeric_task && Boolean(t.linked_monthly_task_id))
          .map((t) => t.id)
      ),
    [tasks]
  );

  const dailyCertificatesChartData = useMemo(() => {
    const now = new Date();
    const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
    const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
    const byDay: Record<string, number> = {};

    for (const log of taskLogs) {
      if (!numericDailyTaskIds.has(log.task_id)) continue;
      if (!log.date || log.date < monthStart || log.date > monthEnd) continue;
      if (log.numeric_value == null) continue;
      byDay[log.date] = (byDay[log.date] || 0) + Number(log.numeric_value);
    }

    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        label: format(new Date(date), "dd MMM"),
        value,
      }));
  }, [taskLogs, numericDailyTaskIds]);

  const monthlyCertificatesChartData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    for (const log of taskLogs) {
      if (!linkedNumericDailyTaskIds.has(log.task_id)) continue;
      if (!log.date || log.numeric_value == null) continue;
      const monthKey = format(new Date(log.date), "yyyy-MM");
      byMonth[monthKey] = (byMonth[monthKey] || 0) + Number(log.numeric_value);
    }

    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(format(d, "yyyy-MM"));
    }

    return months.map((m) => ({
      month: format(new Date(`${m}-01`), "MMM yyyy"),
      value: byMonth[m] || 0,
    }));
  }, [taskLogs, linkedNumericDailyTaskIds]);

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="option-surface flex flex-col gap-6 p-6 md:p-8">
      {user && <TaskProgressRings tasks={pieChartTasks} />}

      <Tabs
        value={taskPeriod}
        onValueChange={(v) => setTaskPeriod(v as "daily" | "weekly" | "monthly")}
        className="flex flex-col gap-5 md:flex-row md:items-start"
      >
        {/* ─── Left Sidebar ─── */}
        <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm md:w-56">
          <div className="border-b border-slate-100 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Tasks</p>
          </div>
          <TabsList className="flex flex-col gap-0.5 bg-transparent p-2">
            {(
              [
                { value: "daily", label: "Daily", count: dailyTasks.length },
                { value: "weekly", label: "Weekly", count: weeklyTasks.length },
                { value: "monthly", label: "Monthly", count: monthlyTasks.length },
              ] as const
            ).map(({ value, label, count }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 shadow-none transition-all duration-150",
                  "hover:bg-slate-100 hover:text-slate-900",
                  "data-[state=active]:bg-primary/10 data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none",
                  "data-[state=inactive]:bg-transparent"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-2 w-2 shrink-0 rounded-full",
                      value === "daily" && "bg-sky-400",
                      value === "weekly" && "bg-violet-400",
                      value === "monthly" && "bg-amber-400",
                      "data-[state=active]:opacity-100 opacity-60 group-hover:opacity-100"
                    )}
                  />
                  {label}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-500 transition-colors group-hover:bg-slate-200 group-data-[state=active]:bg-primary/20 group-data-[state=active]:text-primary">
                  {count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        {/* ─── Right Content Panel ─── */}
        <section className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* ═══════════════ DAILY TAB ═══════════════ */}
          <TabsContent value="daily" className="mt-0 flex flex-col data-[state=inactive]:hidden">
            <Tabs defaultValue="current" className="flex flex-col">

              {/* Toolbar */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <TabsList className={TASK_SUB_TAB_LIST}>
                  <TabsTrigger value="current" className={TASK_SUB_TAB_TRIGGER}>
                    Current ({dailyCurrentTodayCount})
                  </TabsTrigger>
                  <TabsTrigger value="history" className={TASK_SUB_TAB_TRIGGER}>
                    History ({dailyHistoryTasks.length})
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    onClick={() => setAddTaskPanelOpen(true)}
                  >
                    + Add Task
                  </Button>
                  <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/90 p-1">
                    <button
                      type="button"
                      onClick={() => setTaskViewMode("list")}
                      className={cn("rounded-md p-1.5 transition-colors", taskViewMode === "list" ? "bg-primary/15 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")}
                      aria-label="List view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskViewMode("board")}
                      className={cn("rounded-md p-1.5 transition-colors", taskViewMode === "board" ? "bg-primary/15 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")}
                      aria-label="Kanban view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" aria-label="Filters">
                      <Filter className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Current sub-tab */}
              <TabsContent value="current" className="mt-0 data-[state=inactive]:hidden">
                <div className="flex flex-col gap-4 p-5">
                  {/* Active Tasks Table */}
                  <TaskTable tasks={dailyFreshTasks} onSubmit={handleSubmit} onView={handleView} />

                  {/* Monthly Numeric Summary cards */}
                  {dailyFreshTasks.some((t) => t.is_numeric_task && t.linked_monthly_task_id) && user && (
                    <div className="space-y-3">
                      {dailyFreshTasks
                        .filter((t) => t.is_numeric_task && t.linked_monthly_task_id)
                        .map((task) => (
                          <MonthlyNumericSummary
                            key={task.id}
                            dailyTask={task}
                            userId={user.id}
                            month={currentMonth}
                          />
                        ))}
                    </div>
                  )}

                  {/* Pending Approvals accordion */}
                  {dailyPendingApprovalTasks.length > 0 && (
                    <details className="group rounded-xl border border-slate-200 bg-slate-50/50">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 hover:bg-slate-100/70">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                            {dailyPendingApprovalTasks.length}
                          </span>
                          Pending Approvals
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="border-t border-slate-200 p-4">
                        <TaskTable tasks={dailyPendingApprovalTasks} onSubmit={handleSubmit} onView={handleView} />
                      </div>
                    </details>
                  )}

                  {/* Certificates chart accordion */}
                  <details className="group rounded-xl border border-slate-200 bg-slate-50/50">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 hover:bg-slate-100/70">
                      <span className="text-sm">Number of Certificates — Daily</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="border-t border-slate-200 p-4">
                      {dailyCertificatesChartData.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">No numeric submissions found for this month.</div>
                      ) : (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyCertificatesChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" />
                              <YAxis />
                              <Tooltip />
                              <Line type="monotone" dataKey="value" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </TabsContent>

              {/* History sub-tab */}
              <TabsContent value="history" className="mt-0 p-5">
                <div className="mb-4 flex flex-wrap gap-3">
                  <Input type="date" className="w-44" value={historyFilters.daily.date} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, daily: { ...prev.daily, date: e.target.value } }))} />
                  <Input placeholder="Search by task name..." className="min-w-[12rem] flex-1" value={historyFilters.daily.taskName} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, daily: { ...prev.daily, taskName: e.target.value } }))} />
                </div>
                {(() => {
                  const filtered = applyHistoryFilters(dailyHistoryTasks, "daily");
                  const groups = groupByAssignedDate(filtered);
                  if (groups.length === 0) return <TaskTable tasks={[]} onSubmit={handleSubmit} onView={handleView} emptyMessage="No history matches these filters." />;
                  return (
                    <div className="space-y-2">
                      {groups.map(([date, tasks]) => (
                        <details key={date} className="group rounded-xl border border-slate-200 bg-slate-50/50">
                          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 hover:bg-slate-100/70">
                            <span className="text-sm font-medium text-slate-700">Assigned {format(new Date(date), "dd MMM yyyy")} &mdash; {tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                          </summary>
                          <div className="border-t border-slate-200 p-4">
                            <TaskTable tasks={tasks} onSubmit={handleSubmit} onView={handleView} />
                          </div>
                        </details>
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ═══════════════ WEEKLY TAB ═══════════════ */}
          <TabsContent value="weekly" className="mt-0 flex flex-col data-[state=inactive]:hidden">
            <Tabs defaultValue="current" className="flex flex-col">

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <TabsList className={TASK_SUB_TAB_LIST}>
                  <TabsTrigger value="current" className={TASK_SUB_TAB_TRIGGER}>
                    Current ({weeklyCurrentTodayCount})
                  </TabsTrigger>
                  <TabsTrigger value="history" className={TASK_SUB_TAB_TRIGGER}>
                    History ({weeklyHistoryTasks.length})
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90" onClick={() => setAddTaskPanelOpen(true)}>
                    + Add Task
                  </Button>
                  <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/90 p-1">
                    <button type="button" onClick={() => setTaskViewMode("list")} className={cn("rounded-md p-1.5 transition-colors", taskViewMode === "list" ? "bg-primary/15 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")} aria-label="List view"><List className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setTaskViewMode("board")} className={cn("rounded-md p-1.5 transition-colors", taskViewMode === "board" ? "bg-primary/15 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")} aria-label="Kanban view"><LayoutGrid className="h-4 w-4" /></button>
                    <button type="button" className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" aria-label="Filters"><Filter className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>

              <TabsContent value="current" className="mt-0 data-[state=inactive]:hidden">
                <div className="flex flex-col gap-4 p-5">
                  <TaskTable tasks={weeklyFreshTasks} onSubmit={handleSubmit} onView={handleView} />

                  {weeklyPendingApprovalTasks.length > 0 && (
                    <details className="group rounded-xl border border-slate-200 bg-slate-50/50">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 hover:bg-slate-100/70">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{weeklyPendingApprovalTasks.length}</span>
                          Pending Approvals
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="border-t border-slate-200 p-4">
                        <TaskTable tasks={weeklyPendingApprovalTasks} onSubmit={handleSubmit} onView={handleView} />
                      </div>
                    </details>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0 p-5">
                <div className="mb-4 flex flex-wrap gap-3">
                  <Input type="date" className="w-44" value={historyFilters.weekly.date} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, weekly: { ...prev.weekly, date: e.target.value } }))} />
                  <Input placeholder="Search by task name..." className="min-w-[12rem] flex-1" value={historyFilters.weekly.taskName} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, weekly: { ...prev.weekly, taskName: e.target.value } }))} />
                </div>
                {(() => {
                  const filtered = applyHistoryFilters(weeklyHistoryTasks, "weekly");
                  const groups = groupByAssignedDate(filtered);
                  if (groups.length === 0) return <TaskTable tasks={[]} onSubmit={handleSubmit} onView={handleView} emptyMessage="No history matches these filters." />;
                  return (
                    <div className="space-y-2">
                      {groups.map(([date, tasks]) => (
                        <details key={date} className="group rounded-xl border border-slate-200 bg-slate-50/50">
                          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 hover:bg-slate-100/70">
                            <span className="text-sm font-medium text-slate-700">Assigned {format(new Date(date), "dd MMM yyyy")} &mdash; {tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                          </summary>
                          <div className="border-t border-slate-200 p-4">
                            <TaskTable tasks={tasks} onSubmit={handleSubmit} onView={handleView} />
                          </div>
                        </details>
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ═══════════════ MONTHLY TAB ═══════════════ */}
          <TabsContent value="monthly" className="mt-0 flex flex-col data-[state=inactive]:hidden">
            <Tabs defaultValue="current" className="flex flex-col">

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <TabsList className={TASK_SUB_TAB_LIST}>
                  <TabsTrigger value="current" className={TASK_SUB_TAB_TRIGGER}>
                    Current ({monthlyCurrentTodayCount})
                  </TabsTrigger>
                  <TabsTrigger value="history" className={TASK_SUB_TAB_TRIGGER}>
                    History ({monthlyHistoryTasks.length})
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90" onClick={() => setAddTaskPanelOpen(true)}>
                    + Add Task
                  </Button>
                  <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/90 p-1">
                    <button type="button" onClick={() => setTaskViewMode("list")} className={cn("rounded-md p-1.5 transition-colors", taskViewMode === "list" ? "bg-primary/15 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")} aria-label="List view"><List className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setTaskViewMode("board")} className={cn("rounded-md p-1.5 transition-colors", taskViewMode === "board" ? "bg-primary/15 text-primary" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800")} aria-label="Kanban view"><LayoutGrid className="h-4 w-4" /></button>
                    <button type="button" className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800" aria-label="Filters"><Filter className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>

              <TabsContent value="current" className="mt-0 data-[state=inactive]:hidden">
                <div className="flex flex-col gap-4 p-5">
                  <TaskTable tasks={monthlyFreshTasks} onSubmit={handleSubmit} onView={handleView} />

                  {monthlyPendingApprovalTasks.length > 0 && (
                    <details className="group rounded-xl border border-slate-200 bg-slate-50/50">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 hover:bg-slate-100/70">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">{monthlyPendingApprovalTasks.length}</span>
                          Pending Approvals
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="border-t border-slate-200 p-4">
                        <TaskTable tasks={monthlyPendingApprovalTasks} onSubmit={handleSubmit} onView={handleView} />
                      </div>
                    </details>
                  )}

                  <details className="group rounded-xl border border-slate-200 bg-slate-50/50">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-slate-700 hover:bg-slate-100/70">
                      <span className="text-sm">Number of Certificates — Monthly</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="border-t border-slate-200 p-4">
                      {monthlyCertificatesChartData.some((p) => p.value > 0) ? (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyCertificatesChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip />
                              <Line type="monotone" dataKey="value" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">No linked daily numeric submissions found yet.</div>
                      )}
                    </div>
                  </details>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0 p-5">
                <div className="mb-4 flex flex-wrap gap-3">
                  <Input type="date" className="w-44" value={historyFilters.monthly.date} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, monthly: { ...prev.monthly, date: e.target.value } }))} />
                  <Input placeholder="Search by task name..." className="min-w-[12rem] flex-1" value={historyFilters.monthly.taskName} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, monthly: { ...prev.monthly, taskName: e.target.value } }))} />
                </div>
                {(() => {
                  const filtered = applyHistoryFilters(monthlyHistoryTasks, "monthly");
                  const groups = groupByAssignedDate(filtered);
                  if (groups.length === 0) return <TaskTable tasks={[]} onSubmit={handleSubmit} onView={handleView} emptyMessage="No history matches these filters." />;
                  return (
                    <div className="space-y-2">
                      {groups.map(([date, tasks]) => (
                        <details key={date} className="group rounded-xl border border-slate-200 bg-slate-50/50">
                          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 hover:bg-slate-100/70">
                            <span className="text-sm font-medium text-slate-700">Assigned {format(new Date(date), "dd MMM yyyy")} &mdash; {tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                          </summary>
                          <div className="border-t border-slate-200 p-4">
                            <TaskTable tasks={tasks} onSubmit={handleSubmit} onView={handleView} />
                          </div>
                        </details>
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </TabsContent>

        </section>
      </Tabs>

      {selectedTask && (
        <TaskLogDialog
          task={selectedTask}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              fetchData();
            }
          }}
          date={format(new Date(), 'yyyy-MM-dd')}
        />
      )}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
            <DialogDescription>
              View complete task information
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Task Name</p>
                <p className="text-sm">{selectedTask.title}</p>
              </div>

              {selectedTask.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">{selectedTask.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="text-sm capitalize">{selectedTask.type}</p>
              </div>

              {selectedTask.is_numeric_task && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unit</p>
                  <p className="text-sm">{selectedTask.numeric_unit || 'units'}</p>
                </div>
              )}

              {selectedTaskLog && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-2">Submission Details</p>
                    
                    {selectedTask.is_numeric_task ? (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Value</p>
                        <p className="text-sm">{selectedTaskLog.numeric_value} {selectedTask.numeric_unit || 'units'}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <p className="text-sm capitalize">{selectedTaskLog.status}</p>
                      </div>
                    )}

                    {selectedTaskLog.submitted_at && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground">Submitted At</p>
                        <p className="text-sm">{format(new Date(selectedTaskLog.submitted_at), 'HH:mm dd/MM/yyyy')}</p>
                      </div>
                    )}

                    {selectedTaskLog.comment && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground">Comment</p>
                        <p className="text-sm">{selectedTaskLog.comment}</p>
                      </div>
                    )}

                    {selectedTaskLog.reason && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground">Reason</p>
                        <p className="text-sm">{selectedTaskLog.reason}</p>
                      </div>
                    )}

                    <div className="mt-2">
                      <p className="text-sm font-medium text-muted-foreground">Manager Approval</p>
                      <p className="text-sm capitalize">{selectedTaskLog.verification_status}</p>
                    </div>

                    {selectedTaskLog.manager_review_comment && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-muted-foreground">Manager Review</p>
                        <p className="text-sm">{selectedTaskLog.manager_review_comment}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addTaskPanelOpen} onOpenChange={setAddTaskPanelOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Create tasks using the same flow as Task Assignment.
            </DialogDescription>
          </DialogHeader>
          {user && (
            <TaskAssignmentPanel
              mode="employee"
              organizationId={user.organization_id}
              currentUserId={user.id}
              assignableUsers={[user]}
              tasks={selfCreatedTasks}
              monthlyNumericLinkOptions={tasks.filter(
                (task) => task.type === "monthly" && task.is_numeric_task
              )}
              monthlyPeriodicLinkOptions={[]}
              onTasksChanged={fetchData}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
