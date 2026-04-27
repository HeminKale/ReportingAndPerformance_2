"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { format, parse, parseISO, startOfMonth } from "date-fns";
import { getCurrentTimeInTimezone, isAfterCutoff, formatInUserTimezone } from "@/lib/utils/timezone";
import { AlertTriangle, CheckCircle, Clock, Star } from "lucide-react";
import type { Attendance, TaskLog, User } from "@/lib/types/database";
import {
  getLogForTaskDate,
  getTasksDueForUserOnDate,
  isApprovedCompletedBefore,
} from "@/lib/gamification/due-tasks";

function sumAttendanceHours(rows: Attendance[]): number {
  let sum = 0;
  for (const row of rows) {
    if (row.clock_in_time && row.clock_out_time) {
      const ms =
        new Date(row.clock_out_time).getTime() - new Date(row.clock_in_time).getTime();
      if (ms > 0) sum += ms / (1000 * 60 * 60);
    }
  }
  return sum;
}

function formatTotalHours(decimalHours: number): string {
  if (decimalHours <= 0) return "0h";
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (m >= 60) {
    return `${h + 1}h`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

function AnimatedClock({ timezone }: { timezone: string }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate rotations based on current time in the given timezone
  const getRotations = () => {
    const zonedTime = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    const seconds = zonedTime.getSeconds();
    const minutes = zonedTime.getMinutes();
    const hours = zonedTime.getHours() % 12;

    return {
      sec: seconds * 6,
      min: minutes * 6 + seconds * 0.1,
      hour: hours * 30 + minutes * 0.5,
    };
  };

  const { sec, min, hour } = getRotations();

  return (
    <div className="relative mx-auto mb-6 h-32 w-32 flex items-center justify-center rounded-full border-[3px] border-white/80 bg-white/40 backdrop-blur-md shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,1)] ring-1 ring-slate-200/50">
      {/* Clock Face Details */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-0.5 bg-slate-300"
          style={{
            height: i % 3 === 0 ? '8px' : '4px',
            transform: `rotate(${i * 30}deg)`,
            top: i % 3 === 0 ? '4px' : '6px',
            transformOrigin: '50% 60px',
          }}
        />
      ))}

      {/* Hour Hand */}
      <div 
        className="absolute w-1 h-10 bg-slate-800 rounded-full origin-bottom shadow-sm transition-transform duration-500 ease-out"
        style={{ bottom: '50%', transform: `rotate(${hour}deg)` }}
      />
      
      {/* Minute Hand */}
      <div 
        className="absolute w-1 h-14 bg-slate-500 rounded-full origin-bottom shadow-sm transition-transform duration-500 ease-out"
        style={{ bottom: '50%', transform: `rotate(${min}deg)` }}
      />
      
      {/* Second Hand */}
      <div 
        className="absolute w-0.5 h-16 bg-red-500 rounded-full origin-bottom shadow-xs transition-transform duration-100 linear"
        style={{ bottom: '50%', transform: `rotate(${sec}deg)` }}
      />
      
      {/* Center Pin */}
      <div className="absolute h-2.5 w-2.5 rounded-full bg-slate-900 border-2 border-white shadow-sm z-10" />
      
      {/* Outer Glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/5 to-transparent pointer-events-none" />
    </div>
  );
}

export default function AttendancePage() {
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [lateDialogOpen, setLateDialogOpen] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const [earlyClockOutDialogOpen, setEarlyClockOutDialogOpen] = useState(false);
  const [earlyClockOutReason, setEarlyClockOutReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [clockInCutoff, setClockInCutoff] = useState("09:15");
  const { toast } = useToast();
  const supabase = createClient();
  const [today, setToday] = useState(format(getCurrentTimeInTimezone('Asia/Kolkata'), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchData();
  }, []);

  const getEffectiveHistoryRange = useCallback((): { from: string; to: string } => {
    const todayStr = format(getCurrentTimeInTimezone('Asia/Kolkata'), "yyyy-MM-dd");
    if (!historyDateFrom && !historyDateTo) {
      return {
        from: format(startOfMonth(getCurrentTimeInTimezone('Asia/Kolkata')), "yyyy-MM-dd"),
        to: todayStr,
      };
    }
    if (historyDateFrom && historyDateTo) {
      let from = historyDateFrom;
      let to = historyDateTo;
      if (from > to) {
        [from, to] = [to, from];
      }
      return { from, to };
    }
    if (historyDateFrom) {
      const end = todayStr < historyDateFrom ? historyDateFrom : todayStr;
      return { from: historyDateFrom, to: end };
    }
    const toDate = parse(historyDateTo, "yyyy-MM-dd", new Date());
    return {
      from: format(startOfMonth(toDate), "yyyy-MM-dd"),
      to: historyDateTo,
    };
  }, [historyDateFrom, historyDateTo]);

  const fetchAttendanceHistory = useCallback(
    async (userId: string) => {
      const { from, to } = getEffectiveHistoryRange();
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });

      if (error) {
        console.error("[Attendance] history fetch error:", error);
        setAttendanceHistory([]);
        return;
      }
      setAttendanceHistory(data || []);
    },
    [getEffectiveHistoryRange, supabase]
  );

  useEffect(() => {
    if (!user?.id) return;
    void fetchAttendanceHistory(user.id);
  }, [user?.id, fetchAttendanceHistory]);

  const fetchData = async (opts?: { refreshHistory?: boolean }) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userData?.organization_id) {
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", userData.organization_id)
        .maybeSingle();
      const raw = orgRow?.settings?.clock_in_cutoff;
      if (typeof raw === "string" && /^\d{2}:\d{2}$/.test(raw)) {
        setClockInCutoff(raw);
      } else {
        setClockInCutoff("09:15");
      }
    }

    const userTimezone = userData?.timezone || 'Asia/Kolkata';
    const currentToday = format(getCurrentTimeInTimezone(userTimezone), 'yyyy-MM-dd');
    setToday(currentToday);

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('date', currentToday)
      .single();

    setUser(userData);
    setAttendance(attendanceData);
    setLoading(false);

    if (opts?.refreshHistory) {
      await fetchAttendanceHistory(authUser.id);
    }
  };

  const runDailyCloseEvaluation = async (attendanceId: string) => {
    try {
      const res = await fetch("/api/gamification/daily-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ attendanceId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        duplicate?: boolean;
        xpDelta?: number;
        streakOk?: boolean;
      };
      if (!json.ok || json.duplicate || typeof json.xpDelta !== "number") return "";
      const bits: string[] = [];
      if (json.streakOk) bits.push("Streak day secured");
      if (json.xpDelta !== 0) bits.push(`${json.xpDelta > 0 ? "+" : ""}${json.xpDelta} XP`);
      return bits.length ? ` ${bits.join(" · ")}.` : "";
    } catch {
      return "";
    }
  };

  const handleClockIn = async () => {
    if (!user) return;

    setActionLoading(true);

    try {
      const isLate = isAfterCutoff(user.timezone, clockInCutoff);

      if (isLate) {
        setLateDialogOpen(true);
        setActionLoading(false);
        return;
      }

      const { data: createdAttendance, error } = await supabase
        .from('attendance')
        .insert({
          user_id: user.id,
          organization_id: user.organization_id,
          date: today,
          clock_in_time: new Date().toISOString(),
          is_late_request: false,
          approval_status: 'approved',
        });

      if (error) throw error;

      toast({
        title: "Clocked in successfully",
        description: "Your attendance has been recorded",
      });

      await fetchData({ refreshHistory: true });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLateClockIn = async () => {
    if (!user || !lateReason.trim()) return;

    setActionLoading(true);

    try {
      const { data: createdAttendance, error } = await supabase
        .from('attendance')
        .insert({
          user_id: user.id,
          organization_id: user.organization_id,
          date: today,
          clock_in_time: new Date().toISOString(),
          is_late_request: true,
          late_reason: lateReason,
          approval_status: 'pending',
        })
        .select("id")
        .single();

      if (error) throw error;

      const { data: managerData } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.manager_id)
        .single();

      if (managerData) {
        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: managerData.id,
            type: 'late_request',
            title: 'Late Clock-In Request',
            message: `${user.full_name} has requested approval for late clock-in`,
            link: `/org/${String(params.orgSlug)}/manager`,
            metadata: {
              actionable: true,
              resource_type: "attendance",
              resource_id: createdAttendance?.id ?? null,
              employee_id: user.id,
              employee_comment: lateReason.trim(),
              employee_comment_label: "Late clock-in",
            },
          });
      }

      toast({
        title: "Late clock-in request submitted",
        description: "Waiting for manager approval",
      });

      setLateDialogOpen(false);
      setLateReason("");
      await fetchData({ refreshHistory: true });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !attendance) return;
    if (attendance.is_late_request && attendance.approval_status === "rejected") {
      return;
    }

    setActionLoading(true);

    try {
      const weekday = parseISO(`${today}T12:00:00`).getDay();
      const { data: allActiveTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", user.organization_id)
        .or(`assigned_to.eq.${user.id},is_common_task.eq.true`)
        .eq("is_active", true);

      const dueToday = getTasksDueForUserOnDate(allActiveTasks || [], user.id, today, weekday);
      const dueIds = dueToday.map((t) => t.id);
      const { data: todayTaskLogs } =
        dueIds.length > 0
          ? await supabase.from("task_logs").select("*").eq("user_id", user.id).eq("date", today).in("task_id", dueIds)
          : { data: [] as TaskLog[] };

      const logs = (todayTaskLogs || []) as TaskLog[];
      let approvedDone = 0;
      const nowIso = new Date().toISOString();
      for (const task of dueToday) {
        const log = getLogForTaskDate(logs, task.id, user.id, today);
        if (isApprovedCompletedBefore(log, nowIso)) {
          approvedDone++;
        }
      }

      if (dueToday.length > 0 && approvedDone < dueToday.length) {
        toast({
          title: "Cannot clock out",
          description: `Complete all tasks due today before clocking out (${approvedDone}/${dueToday.length} completed).`,
          variant: "destructive",
        });
        setActionLoading(false);
        return;
      }

      const localNow = getCurrentTimeInTimezone(user.timezone);
      const isEarlyClockOut = localNow.getHours() < 17;
      if (isEarlyClockOut) {
        setEarlyClockOutDialogOpen(true);
        setActionLoading(false);
        return;
      }

      const { error } = await supabase
        .from('attendance')
        .update({
          clock_out_time: new Date().toISOString(),
        })
        .eq('id', attendance.id);

      if (error) throw error;

      const extra = await runDailyCloseEvaluation(attendance.id);

      toast({
        title: "Clocked out successfully",
        description: `Have a great day!${extra}`,
      });

      await fetchData({ refreshHistory: true });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEarlyClockOutRequest = async () => {
    if (!user || !attendance || !earlyClockOutReason.trim()) return;

    setActionLoading(true);

    try {
      const combinedReason = attendance.late_reason
        ? `${attendance.late_reason}\nEarly clock-out: ${earlyClockOutReason}`
        : `Early clock-out: ${earlyClockOutReason}`;

      const { error } = await supabase
        .from('attendance')
        .update({
          clock_out_time: new Date().toISOString(),
          is_late_request: true,
          late_reason: combinedReason,
          approval_status: 'pending',
          approved_by: null,
        })
        .eq('id', attendance.id);

      if (error) throw error;

      const extra = await runDailyCloseEvaluation(attendance.id);

      if (user.manager_id) {
        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: user.manager_id,
            type: 'late_request',
            title: 'Early Clock-Out Request',
            message: `${user.full_name} has requested approval for early clock-out`,
            link: `/org/${String(params.orgSlug)}/manager`,
            metadata: {
              actionable: true,
              resource_type: "attendance",
              resource_id: attendance.id,
              employee_id: user.id,
              employee_comment: combinedReason,
              employee_comment_label: "Clock-out / approval note",
            },
          });
      }

      toast({
        title: "Early clock-out request submitted",
        description: `Waiting for manager approval.${extra}`,
      });

      setEarlyClockOutDialogOpen(false);
      setEarlyClockOutReason("");
      await fetchData({ refreshHistory: true });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="option-surface p-6 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded-lg bg-muted" />
          <div className="h-64 rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  const totalHoursDecimal = sumAttendanceHours(attendanceHistory);
  const totalHoursDisplay = formatTotalHours(totalHoursDecimal);

  const attendanceRequestRejected = Boolean(
    attendance?.is_late_request && attendance.approval_status === "rejected"
  );
  const clockOutDisabledByApproval =
    attendanceRequestRejected || attendance?.approval_status === "pending";

  return (
    <div className="option-surface flex min-h-0 w-full flex-1 flex-col gap-4 p-6 md:p-8">
      <h1 className="shrink-0 text-3xl font-bold tracking-tight">Attendance</h1>

      <div className="grid min-h-0 w-full flex-1 gap-6 md:grid-cols-2 md:items-stretch md:min-h-[calc(100dvh-9.5rem)]">
        <Card className="flex h-full min-h-0 flex-col rounded-2xl border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-100/80 pb-4">
            <CardTitle className="text-lg font-semibold">Clock In/Out</CardTitle>
            <CardDescription>
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-6">
            <div className="flex items-center justify-center rounded-2xl border border-white/60 bg-gradient-to-b from-white/80 to-slate-50/50 p-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.8)] backdrop-blur-sm ring-1 ring-white/40">
              <div className="text-center">
                {user && <AnimatedClock timezone={user.timezone || 'Asia/Kolkata'} />}
                <div className="mb-2 text-4xl font-black tabular-nums tracking-tighter text-slate-900 drop-shadow-sm">
                  {user && formatInUserTimezone(new Date(), user.timezone, "h:mm:ss a")}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 border border-slate-200/50 text-[10px] font-bold uppercase tracking-widest text-slate-500 shadow-sm">
                   <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                   {user?.timezone}
                </div>
              </div>
            </div>

            {attendance ? (
              <div className="space-y-4">
                <div
                  className={
                    attendanceRequestRejected
                      ? "flex items-start justify-between gap-3 rounded-xl border border-amber-200/90 bg-amber-50/90 p-4 shadow-sm ring-1 ring-amber-200/30"
                      : "flex items-center justify-between rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-4 shadow-sm ring-1 ring-emerald-200/25"
                  }
                >
                  <div className="flex items-start gap-3">
                    {attendanceRequestRejected ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    ) : (
                      <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                    )}
                    <div>
                      <p className="font-medium">
                        {attendanceRequestRejected ? "Attendance not accepted" : "Clocked In"}
                      </p>
                      {attendance.clock_in_time && user && (
                        <p className="text-sm text-muted-foreground">
                          {attendanceRequestRejected
                            ? `Time recorded: ${formatInUserTimezone(
                                attendance.clock_in_time,
                                user.timezone,
                                "h:mm a"
                              )} — your request was not approved.`
                            : formatInUserTimezone(
                                attendance.clock_in_time,
                                user.timezone,
                                "h:mm a"
                              )}
                        </p>
                      )}
                      {attendanceRequestRejected && attendance.late_reason && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium">Your request:</span> {attendance.late_reason}
                        </p>
                      )}
                      {attendanceRequestRejected && attendance.manager_comment && (
                        <p className="mt-1 text-sm text-foreground">
                          <span className="font-medium">Manager comment:</span> {attendance.manager_comment}
                        </p>
                      )}
                    </div>
                  </div>
                  {attendance.is_late_request && (
                    <span
                      className={`shrink-0 text-xs rounded px-2 py-1 ${
                        attendance.approval_status === "approved"
                          ? "bg-green-100 text-green-800"
                          : attendance.approval_status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {attendance.approval_status}
                    </span>
                  )}
                </div>

                {attendance.clock_out_time ? (
                  <div className="flex items-center gap-3 rounded-xl border border-sky-200/70 bg-sky-50/80 p-4 shadow-sm ring-1 ring-sky-200/25">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Clocked Out</p>
                      <p className="text-sm text-muted-foreground">
                        {user && formatInUserTimezone(attendance.clock_out_time, user.timezone, "h:mm a")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleClockOut}
                    disabled={actionLoading || clockOutDisabledByApproval}
                    variant="outline"
                    className="w-full border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10"
                    title={
                      attendanceRequestRejected
                        ? "Clock in/out is not available while your request is rejected for today."
                        : undefined
                    }
                  >
                    {actionLoading ? "Processing..." : "Clock Out"}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleClockIn}
                disabled={actionLoading}
                variant="outline"
                className="w-full border-primary/50 bg-transparent text-primary hover:bg-primary/10"
                size="lg"
              >
                {actionLoading ? "Processing..." : "Clock In"}
              </Button>
            )}

            {user && isAfterCutoff(user.timezone, clockInCutoff) && !attendance && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm ring-1 ring-amber-200/25">
                <p className="text-sm text-amber-900/90">
                  It's past {clockInCutoff}. You'll need to provide a reason for late clock-in.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col rounded-2xl border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/40">
          <CardHeader className="shrink-0 border-b border-slate-100/80 pb-4">
            <CardTitle className="text-lg font-semibold">Attendance History</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
            <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="historyDateFrom">From</Label>
                  <Input
                    id="historyDateFrom"
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="historyDateTo">To</Label>
                  <Input
                    id="historyDateTo"
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end shrink-0">
                <div className="inline-flex w-fit max-w-full items-baseline gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 shadow-sm ring-1 ring-slate-200/30">
                  <span className="text-sm text-muted-foreground">Total Hours:</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {totalHoursDisplay}
                  </span>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {attendanceHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No attendance records in this date range
              </p>
            ) : (
              <div className="space-y-3 pb-2">
                {attendanceHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">{format(new Date(item.date), "EEE, MMM d, yyyy")}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.approval_status === "approved"
                          ? "bg-green-100 text-green-800"
                          : item.approval_status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {item.approval_status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Clock In</p>
                        <p>
                          {item.clock_in_time && user
                            ? formatInUserTimezone(item.clock_in_time, user.timezone, "h:mm a")
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Clock Out</p>
                        <p>
                          {item.clock_out_time && user
                            ? formatInUserTimezone(item.clock_out_time, user.timezone, "h:mm a")
                            : "-"}
                        </p>
                      </div>
                    </div>
                    {(item.late_reason || item.manager_comment) && (
                      <div className="mt-2 text-sm space-y-1">
                        {item.late_reason && (
                          <p>
                            <span className="font-medium">Reason:</span> {item.late_reason}
                          </p>
                        )}
                        {item.manager_comment && (
                          <p>
                            <span className="font-medium">Manager Comment:</span> {item.manager_comment}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={lateDialogOpen} onOpenChange={setLateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Late Clock-In Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for clocking in after {clockInCutoff}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lateReason">Reason (required)</Label>
              <Textarea
                id="lateReason"
                placeholder="Explain why you're clocking in late..."
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleLateClockIn} 
              disabled={actionLoading || !lateReason.trim()}
            >
              {actionLoading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={earlyClockOutDialogOpen} onOpenChange={setEarlyClockOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Early Clock-Out Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for clocking out before 5:00 PM
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="earlyClockOutReason">Reason (required)</Label>
              <Textarea
                id="earlyClockOutReason"
                placeholder="Explain why you're clocking out early..."
                value={earlyClockOutReason}
                onChange={(e) => setEarlyClockOutReason(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEarlyClockOutDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEarlyClockOutRequest}
              disabled={actionLoading || !earlyClockOutReason.trim()}
            >
              {actionLoading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
