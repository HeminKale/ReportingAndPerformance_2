"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatInUserTimezone } from "@/lib/utils/timezone";
import { cn } from "@/lib/utils/cn";
import type { Attendance, Leave, Task, TaskLog, User } from "@/lib/types/database";
import {
  dayKey,
  getIncompleteKind,
  incompleteStripeLabel,
  isApprovedCompletedLog,
  isClockInLate,
  isClockOutBeforeEnd,
  logMapKey,
  taskDueOnDay,
  type IncompleteKind,
} from "@/lib/calendar/calendar-utils";

type CalendarData = {
  user: User;
  clockInCutoff: string;
  tasks: Task[];
  taskLogs: TaskLog[];
  attendanceByDate: Record<string, Attendance>;
  leaves: Leave[];
};

function useLeaveTimer() {
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearLeave = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);
  const scheduleLeave = useCallback(
    (fn: () => void, ms = 120) => {
      clearLeave();
      leaveTimer.current = setTimeout(fn, ms);
    },
    [clearLeave]
  );
  return { clearLeave, scheduleLeave };
}

function TaskHoverPanel({
  tasks,
  title,
}: {
  tasks: { id: string; title: string; type: Task["type"] }[];
  title: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200/90 bg-card p-2.5 text-xs shadow-lg ring-1 ring-slate-200/40",
        "max-h-44 w-max min-w-[200px] max-w-[280px] overflow-y-auto z-[70]"
      )}
      onMouseDown={(e) => e.preventDefault()}
    >
      <p className="font-semibold text-muted-foreground mb-2">{title}</p>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-1.5 gap-y-1">
            <span className="font-medium text-foreground leading-tight">{t.title}</span>
            <Badge variant="outline" className="capitalize shrink-0 text-[10px] px-1.5 py-0 h-5">
              {t.type}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalendarDayCell({
  day,
  currentMonth,
  leave,
  userTimezone,
  clockInCutoff,
  tasks,
  logsMap,
  attendance,
}: {
  day: Date;
  currentMonth: Date;
  leave: Leave | undefined;
  userTimezone: string;
  clockInCutoff: string;
  tasks: Task[];
  logsMap: Map<string, TaskLog>;
  attendance: Attendance | undefined;
}) {
  const [hoverKind, setHoverKind] = useState<"incomplete" | "completed" | null>(null);
  const { clearLeave, scheduleLeave } = useLeaveTimer();

  const dateStr = dayKey(day);
  const today = isToday(day);
  const isLeave = !!leave;

  const { incompleteLines, completedLines, kindPerIncomplete } = useMemo(() => {
    const due = tasks.filter((t) => taskDueOnDay(t, day));
    const incomplete: { task: Task; log?: TaskLog; kind: IncompleteKind }[] = [];
    const completed: { task: Task; log: TaskLog }[] = [];
    for (const task of due) {
      const log = logsMap.get(logMapKey(task.id, dateStr));
      if (isApprovedCompletedLog(log)) {
        completed.push({ task, log: log! });
      } else {
        incomplete.push({ task, log, kind: getIncompleteKind(log) });
      }
    }
    return {
      incompleteLines: incomplete,
      completedLines: completed,
      kindPerIncomplete: incomplete.map((i) => i.kind),
    };
  }, [tasks, logsMap, day, dateStr]);

  const incompleteTasksForPanel = incompleteLines.map((l) => ({
    id: l.task.id,
    title: l.task.title,
    type: l.task.type,
  }));
  const completedTasksForPanel = completedLines.map((l) => ({
    id: l.task.id,
    title: l.task.title,
    type: l.task.type,
  }));

  const anyDueIncomplete = incompleteLines.length > 0;

  const clockInBad =
    attendance?.clock_in_time &&
    isClockInLate(attendance.clock_in_time, userTimezone, clockInCutoff);

  const clockOutBad =
    attendance?.clock_out_time &&
    (isClockOutBeforeEnd(attendance.clock_out_time, userTimezone) || anyDueIncomplete);

  const stripeBase = "text-[11px] leading-tight px-1.5 py-0.5 rounded font-medium";
  const redStripe = "bg-red-100/90 text-red-900";
  const greenStripe = "bg-green-100/90 text-green-900";

  return (
    <div
      className={cn(
        "relative z-0 flex min-h-[140px] flex-col overflow-visible rounded-xl border p-2 transition-all hover:z-50",
        isLeave
          ? "border-emerald-200/85 bg-gradient-to-b from-emerald-50/95 to-emerald-50/50 shadow-sm ring-1 ring-emerald-200/40"
          : today
            ? "border-2 border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
            : "border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60 shadow-sm ring-1 ring-slate-200/30 hover:border-slate-300/80 hover:shadow-md",
        isLeave && today && "ring-2 ring-primary/35",
        !isSameMonth(day, currentMonth) && "opacity-50"
      )}
    >
      <div className="text-sm font-semibold mb-1.5 shrink-0">{format(day, "d")}</div>

      {isLeave && leave ? (
        <div className="rounded-md bg-emerald-200/90 px-2 py-1.5 text-xs font-medium capitalize text-emerald-900 shadow-sm ring-1 ring-emerald-300/50">
          Leave: {leave.leave_type}
        </div>
      ) : (
        <div className="flex flex-col gap-1 flex-1 min-h-0">
          {attendance?.clock_in_time && (
            <div
              className={cn(stripeBase, clockInBad ? redStripe : greenStripe)}
              title="Clock in"
            >
              Clock-in:{" "}
              {formatInUserTimezone(attendance.clock_in_time, userTimezone, "h:mm a")}
            </div>
          )}

          {incompleteLines.length > 0 && (
            <div
              className="relative"
              onMouseEnter={() => {
                clearLeave();
                setHoverKind("incomplete");
              }}
              onMouseLeave={() => {
                scheduleLeave(() => setHoverKind(null));
              }}
            >
              <div
                className={cn(stripeBase, redStripe, "cursor-default")}
                title="Incomplete tasks"
              >
                {incompleteStripeLabel(kindPerIncomplete)}
              </div>
              {hoverKind === "incomplete" && (
                <div
                  className="absolute left-0 top-full mt-0.5 z-[100]"
                  onMouseEnter={() => clearLeave()}
                  onMouseLeave={() => scheduleLeave(() => setHoverKind(null))}
                >
                  <TaskHoverPanel tasks={incompleteTasksForPanel} title="Incomplete" />
                </div>
              )}
            </div>
          )}

          {completedLines.length > 0 && (
            <div
              className="relative"
              onMouseEnter={() => {
                clearLeave();
                setHoverKind("completed");
              }}
              onMouseLeave={() => {
                scheduleLeave(() => setHoverKind(null));
              }}
            >
              <div
                className={cn(stripeBase, greenStripe, "cursor-default")}
                title="Completed (approved)"
              >
                Completed: {completedLines.length}
              </div>
              {hoverKind === "completed" && (
                <div
                  className="absolute left-0 top-full mt-0.5 z-[100]"
                  onMouseEnter={() => clearLeave()}
                  onMouseLeave={() => scheduleLeave(() => setHoverKind(null))}
                >
                  <TaskHoverPanel tasks={completedTasksForPanel} title="Completed" />
                </div>
              )}
            </div>
          )}

          {attendance?.clock_out_time && (
            <div
              className={cn(stripeBase, clockOutBad ? redStripe : greenStripe)}
              title="Clock out"
            >
              Clock-out:{" "}
              {formatInUserTimezone(attendance.clock_out_time, userTimezone, "h:mm a")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type EmployeeCalendarPanelProps = {
  subjectUserId: string;
  /** When set with `onMonthChange`, month navigation is controlled by the parent. */
  currentMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Hide card chrome and month controls (parent provides layout and navigation). */
  embedded?: boolean;
};

export function EmployeeCalendarPanel({
  subjectUserId,
  currentMonth: controlledMonth,
  onMonthChange,
  embedded = false,
}: EmployeeCalendarPanelProps) {
  const [internalMonth, setInternalMonth] = useState(() => new Date());
  const currentMonth = controlledMonth ?? internalMonth;
  const setMonth = (next: Date) => {
    if (onMonthChange) onMonthChange(next);
    else setInternalMonth(next);
  };

  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchCalendarData = async () => {
      setLoading(true);

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const from = format(monthStart, "yyyy-MM-dd");
      const to = format(monthEnd, "yyyy-MM-dd");

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", subjectUserId)
        .single();

      if (!userData) {
        setData(null);
        setLoading(false);
        return;
      }

      const { data: orgData } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", userData.organization_id)
        .single();

      const settings = orgData?.settings as { clock_in_cutoff?: string } | undefined;
      const clockInCutoff = settings?.clock_in_cutoff ?? "09:15";

      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", userData.organization_id)
        .or(`assigned_to.eq.${subjectUserId},is_common_task.eq.true`)
        .eq("is_active", true);

      const tasks = (tasksData || []) as Task[];
      const taskIds = tasks.map((t) => t.id);

      const { data: logsData } =
        taskIds.length > 0
          ? await supabase
              .from("task_logs")
              .select("*")
              .eq("user_id", subjectUserId)
              .in("task_id", taskIds)
              .gte("date", from)
              .lte("date", to)
          : { data: [] as TaskLog[] };

      const { data: attendanceRows } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", subjectUserId)
        .gte("date", from)
        .lte("date", to);

      const { data: leavesData } = await supabase
        .from("leaves")
        .select("*")
        .eq("user_id", subjectUserId)
        .eq("status", "approved")
        .lte("start_date", to)
        .gte("end_date", from);

      const attendanceByDate: Record<string, Attendance> = {};
      for (const row of attendanceRows || []) {
        attendanceByDate[row.date] = row as Attendance;
      }

      setData({
        user: userData as User,
        clockInCutoff,
        tasks,
        taskLogs: (logsData || []) as TaskLog[],
        attendanceByDate,
        leaves: (leavesData || []) as Leave[],
      });
      setLoading(false);
    };

    fetchCalendarData();
  }, [currentMonth, subjectUserId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const logsMap = useMemo(() => {
    const m = new Map<string, TaskLog>();
    if (!data?.taskLogs) return m;
    for (const log of data.taskLogs) {
      m.set(logMapKey(log.task_id, log.date), log);
    }
    return m;
  }, [data?.taskLogs]);

  const getLeaveForDay = useCallback(
    (date: Date) => {
      return data?.leaves.find((leave) => {
        const leaveStart = parseISO(leave.start_date);
        const leaveEnd = parseISO(leave.end_date);
        return date >= leaveStart && date <= leaveEnd;
      });
    },
    [data?.leaves]
  );

  if (loading) {
    if (embedded) {
      return (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading calendar…</div>
      );
    }
    return (
      <Card className="overflow-visible rounded-2xl border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/40">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded-lg bg-muted" />
            <div className="h-[min(70vh,640px)] rounded-2xl bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    const msg = "Unable to load this employee’s calendar.";
    if (embedded) {
      return <p className="text-sm text-muted-foreground py-6">{msg}</p>;
    }
    return (
      <Card className="overflow-visible rounded-2xl border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/40">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">{msg}</p>
        </CardContent>
      </Card>
    );
  }

  const { user, clockInCutoff, tasks, attendanceByDate } = data;

  const gridAndLegend = (
    <>
      <div className="grid grid-cols-7 gap-2 md:gap-3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-center font-semibold text-xs md:text-sm py-2 text-muted-foreground"
          >
            {d}
          </div>
        ))}

        {Array.from({ length: monthStart.getDay() }).map((_, index) => (
          <div key={`empty-${index}`} className="min-h-[140px]" aria-hidden />
        ))}

        {daysInMonth.map((day) => {
          const dateStr = dayKey(day);
          const leave = getLeaveForDay(day);
          return (
            <CalendarDayCell
              key={dateStr}
              day={day}
              currentMonth={currentMonth}
              leave={leave}
              userTimezone={user.timezone}
              clockInCutoff={clockInCutoff}
              tasks={tasks}
              logsMap={logsMap}
              attendance={attendanceByDate[dateStr]}
            />
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs md:text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary rounded shrink-0" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border border-border rounded shrink-0" />
          <span>Leave (hides other details)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 bg-green-100/90 border border-green-200/80 rounded shrink-0" />
          <span>On time / OK</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 bg-red-100/90 border border-red-200/80 rounded shrink-0" />
          <span>Late clock-in, early clock-out, or incomplete tasks at clock-out</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Tasks:</span>
          <span>Incomplete stripe (red) — hover for names; Completed (approved) stripe (green)</span>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return <div className="overflow-visible pt-0">{gridAndLegend}</div>;
  }

  return (
    <Card className="overflow-visible rounded-2xl border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/40">
      <CardHeader className="border-b border-slate-100/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-xl font-semibold tracking-tight">
            {format(currentMonth, "MMMM yyyy")}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-visible bg-gradient-to-b from-white to-slate-50/30 pt-6">
        {gridAndLegend}
      </CardContent>
    </Card>
  );
}
