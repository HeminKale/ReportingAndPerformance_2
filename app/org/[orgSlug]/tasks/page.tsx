"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskLogDialog } from "@/components/tasks/task-log-dialog";
import { TaskTable } from "@/components/tasks/task-table";
import { MonthlyNumericSummary } from "@/components/tasks/monthly-numeric-summary";
import { TaskAssignmentPanel } from "@/components/shared/task-assignment-panel";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Filter, LayoutGrid, List } from "lucide-react";
import type { Task, TaskLog, User } from "@/lib/types/database";

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

  // Prepared for Phase 2 (Current/History sub-tabs + history accordion).
  const dailyHistoryTasks = historyTasks.filter(t => t.type === 'daily');
  const weeklyHistoryTasks = historyTasks.filter(t => t.type === 'weekly');
  const monthlyHistoryTasks = historyTasks.filter(t => t.type === 'monthly');

  const isPendingApprovalTask = (task: (Task & { taskLog?: TaskLog })) => {
    const log = task.taskLog;
    if (!log) return false;
    return log.status === 'completed' && log.verification_status !== 'approved';
  };

  const dailyPendingApprovalTasks = dailyTasks.filter(isPendingApprovalTask);
  const weeklyPendingApprovalTasks = weeklyTasks.filter(isPendingApprovalTask);
  const monthlyPendingApprovalTasks = monthlyTasks.filter(isPendingApprovalTask);

  const dailyFreshTasks = dailyTasks.filter((t) => !isPendingApprovalTask(t));
  const weeklyFreshTasks = weeklyTasks.filter((t) => !isPendingApprovalTask(t));
  const monthlyFreshTasks = monthlyTasks.filter((t) => !isPendingApprovalTask(t));

  const isAssignedToday = (task: Task) => getAssignedDay(task.created_at) === today;
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
    <div className="option-surface flex min-h-0 flex-1 flex-col gap-6 p-6 md:p-8">
      <Tabs
        value={taskPeriod}
        onValueChange={(v) => setTaskPeriod(v as "daily" | "weekly" | "monthly")}
        className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row md:items-stretch"
      >
        <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:w-[240px]">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tasks</p>
          <p className="mt-1 text-sm text-slate-600">Daily, weekly, and monthly work.</p>
          <TabsList className="mt-4 flex w-full flex-col gap-2 bg-transparent p-0">
            <TabsTrigger
              value="daily"
              className="flex h-auto w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:[&>span:last-child]:bg-white/20 data-[state=active]:[&>span:last-child]:text-white"
            >
              <span>Daily</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-800">
                {dailyTasks.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="weekly"
              className="flex h-auto w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:[&>span:last-child]:bg-white/20 data-[state=active]:[&>span:last-child]:text-white"
            >
              <span>Weekly</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-800">
                {weeklyTasks.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="monthly"
              className="flex h-auto w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:[&>span:last-child]:bg-white/20 data-[state=active]:[&>span:last-child]:text-white"
            >
              <span>Monthly</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-800">
                {monthlyTasks.length}
              </span>
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            className="mt-6 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => setAddTaskPanelOpen(true)}
          >
            + Add Task
          </Button>
        </aside>

        <section className="option-panel flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <TabsContent value="daily" className="mt-0 flex min-h-0 flex-1 flex-col space-y-4">
          <Tabs defaultValue="current" className="flex min-h-0 flex-1 flex-col space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <TabsList className="option-tablist h-auto rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="current">Current ({dailyCurrentTodayCount})</TabsTrigger>
                <TabsTrigger value="history">History ({dailyHistoryTasks.length})</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setTaskViewMode("list")}
                  className={`rounded-md p-1.5 ${taskViewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTaskViewMode("board")}
                  className={`rounded-md p-1.5 ${taskViewMode === "board" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                  aria-label="Board view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-md p-1.5 text-slate-500" aria-label="Filters">
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>

            <TabsContent value="current" className="space-y-6">
              {dailyFreshTasks.some(t => t.is_numeric_task && t.linked_monthly_task_id) && user && (
                <div className="space-y-4">
                  {dailyFreshTasks
                    .filter(t => t.is_numeric_task && t.linked_monthly_task_id)
                    .map(task => (
                      <MonthlyNumericSummary
                        key={task.id}
                        dailyTask={task}
                        userId={user.id}
                        month={currentMonth}
                      />
                    ))}
                </div>
              )}
              <TaskTable 
                tasks={dailyFreshTasks} 
                onSubmit={handleSubmit}
                onView={handleView}
              />
              {dailyPendingApprovalTasks.length > 0 && (
                <details className="rounded-lg border">
                  <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                    Pending approvals ({dailyPendingApprovalTasks.length})
                  </summary>
                  <div className="border-t p-4">
                    <TaskTable
                      tasks={dailyPendingApprovalTasks}
                      onSubmit={handleSubmit}
                      onView={handleView}
                    />
                  </div>
                </details>
              )}

              <details className="rounded-lg border">
                <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                  Number of certificates-daily
                </summary>
                <div className="border-t p-4">
                  {dailyCertificatesChartData.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      No numeric submissions found for this month.
                    </div>
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
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex gap-3">
                <Input
                  type="date"
                  className="w-44"
                  value={historyFilters.daily.date}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({
                      ...prev,
                      daily: { ...prev.daily, date: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Search by task name..."
                  className="flex-1"
                  value={historyFilters.daily.taskName}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({
                      ...prev,
                      daily: { ...prev.daily, taskName: e.target.value },
                    }))
                  }
                />
              </div>
              {(() => {
                const filtered = applyHistoryFilters(dailyHistoryTasks, 'daily');
                const groups = groupByAssignedDate(filtered);
                if (groups.length === 0) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      No history found
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {groups.map(([date, tasks]) => (
                      <details key={date} className="rounded-lg border">
                        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                          Assigned {format(new Date(date), 'dd MMM yyyy')} &mdash; {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="border-t p-4">
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

        <TabsContent value="weekly" className="mt-0 flex min-h-0 flex-1 flex-col space-y-4">
          <Tabs defaultValue="current" className="flex min-h-0 flex-1 flex-col space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <TabsList className="option-tablist h-auto rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="current">Current ({weeklyCurrentTodayCount})</TabsTrigger>
                <TabsTrigger value="history">History ({weeklyHistoryTasks.length})</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setTaskViewMode("list")}
                  className={`rounded-md p-1.5 ${taskViewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTaskViewMode("board")}
                  className={`rounded-md p-1.5 ${taskViewMode === "board" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                  aria-label="Board view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-md p-1.5 text-slate-500" aria-label="Filters">
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>

            <TabsContent value="current">
              <TaskTable 
                tasks={weeklyFreshTasks} 
                onSubmit={handleSubmit}
                onView={handleView}
              />
              {weeklyPendingApprovalTasks.length > 0 && (
                <details className="mt-4 rounded-lg border">
                  <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                    Pending approvals ({weeklyPendingApprovalTasks.length})
                  </summary>
                  <div className="border-t p-4">
                    <TaskTable
                      tasks={weeklyPendingApprovalTasks}
                      onSubmit={handleSubmit}
                      onView={handleView}
                    />
                  </div>
                </details>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex gap-3">
                <Input
                  type="date"
                  className="w-44"
                  value={historyFilters.weekly.date}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({
                      ...prev,
                      weekly: { ...prev.weekly, date: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Search by task name..."
                  className="flex-1"
                  value={historyFilters.weekly.taskName}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({
                      ...prev,
                      weekly: { ...prev.weekly, taskName: e.target.value },
                    }))
                  }
                />
              </div>
              {(() => {
                const filtered = applyHistoryFilters(weeklyHistoryTasks, 'weekly');
                const groups = groupByAssignedDate(filtered);
                if (groups.length === 0) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      No history found
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {groups.map(([date, tasks]) => (
                      <details key={date} className="rounded-lg border">
                        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                          Assigned {format(new Date(date), 'dd MMM yyyy')} &mdash; {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="border-t p-4">
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

        <TabsContent value="monthly" className="mt-0 flex min-h-0 flex-1 flex-col space-y-4">
          <Tabs defaultValue="current" className="flex min-h-0 flex-1 flex-col space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <TabsList className="option-tablist h-auto rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="current">Current ({monthlyCurrentTodayCount})</TabsTrigger>
                <TabsTrigger value="history">History ({monthlyHistoryTasks.length})</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setTaskViewMode("list")}
                  className={`rounded-md p-1.5 ${taskViewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTaskViewMode("board")}
                  className={`rounded-md p-1.5 ${taskViewMode === "board" ? "bg-slate-100 text-slate-900" : "text-slate-500"}`}
                  aria-label="Board view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-md p-1.5 text-slate-500" aria-label="Filters">
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>

            <TabsContent value="current">
              <TaskTable 
                tasks={monthlyFreshTasks} 
                onSubmit={handleSubmit}
                onView={handleView}
              />
              {monthlyPendingApprovalTasks.length > 0 && (
                <details className="mt-4 rounded-lg border">
                  <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                    Pending approvals ({monthlyPendingApprovalTasks.length})
                  </summary>
                  <div className="border-t p-4">
                    <TaskTable
                      tasks={monthlyPendingApprovalTasks}
                      onSubmit={handleSubmit}
                      onView={handleView}
                    />
                  </div>
                </details>
              )}

              <details className="mt-4 rounded-lg border">
                <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                  Number of certificates-monthly
                </summary>
                <div className="border-t p-4">
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
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      No linked daily numeric submissions found yet.
                    </div>
                  )}
                </div>
              </details>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex gap-3">
                <Input
                  type="date"
                  className="w-44"
                  value={historyFilters.monthly.date}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({
                      ...prev,
                      monthly: { ...prev.monthly, date: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Search by task name..."
                  className="flex-1"
                  value={historyFilters.monthly.taskName}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({
                      ...prev,
                      monthly: { ...prev.monthly, taskName: e.target.value },
                    }))
                  }
                />
              </div>
              {(() => {
                const filtered = applyHistoryFilters(monthlyHistoryTasks, 'monthly');
                const groups = groupByAssignedDate(filtered);
                if (groups.length === 0) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      No history found
                    </div>
                  );
                }
                return (
                  <div className="space-y-2">
                    {groups.map(([date, tasks]) => (
                      <details key={date} className="rounded-lg border">
                        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                          Assigned {format(new Date(date), 'dd MMM yyyy')} &mdash; {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="border-t p-4">
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
