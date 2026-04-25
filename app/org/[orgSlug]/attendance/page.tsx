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
import { format, parse, startOfMonth } from "date-fns";
import { getCurrentTimeInTimezone, isAfterCutoff, formatInUserTimezone } from "@/lib/utils/timezone";
import { Clock, CheckCircle } from "lucide-react";
import type { Attendance, User } from "@/lib/types/database";

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
  const { toast } = useToast();
  const supabase = createClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchData();
  }, []);

  const getEffectiveHistoryRange = useCallback((): { from: string; to: string } => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (!historyDateFrom && !historyDateTo) {
      return {
        from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
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

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('date', today)
      .single();

    setUser(userData);
    setAttendance(attendanceData);
    setLoading(false);

    if (opts?.refreshHistory) {
      await fetchAttendanceHistory(authUser.id);
    }
  };

  const handleClockIn = async () => {
    if (!user) return;

    setActionLoading(true);

    try {
      const isLate = isAfterCutoff(user.timezone, '09:15');

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

    setActionLoading(true);

    try {
      const { data: allDailyTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('organization_id', user.organization_id)
        .or(`assigned_to.eq.${user.id},is_common_task.eq.true`)
        .eq('is_active', true)
        .eq('type', 'daily');

      const dailyTaskIds = (allDailyTasks || []).map((task) => task.id);

      const { data: todayTaskLogs } = await supabase
        .from('task_logs')
        .select('task_id,status,verification_status')
        .eq('user_id', user.id)
        .eq('date', today)
        .in('task_id', dailyTaskIds);

      const submittedTaskIds = new Set(
        (todayTaskLogs || []).map(log => log.task_id)
      );

      const unsubmittedTasks = (allDailyTasks || []).filter(task => !submittedTaskIds.has(task.id));
      const pendingTasks = (todayTaskLogs || []).filter(log => log.status !== 'completed');
      const rejectedTasks = (todayTaskLogs || []).filter(log => log.verification_status === 'rejected');

      if (unsubmittedTasks.length > 0 || pendingTasks.length > 0 || rejectedTasks.length > 0) {
        toast({
          title: "Cannot clock out",
          description: rejectedTasks.length > 0
            ? "Please resubmit rejected daily tasks before clocking out"
            : "Please complete or mark all daily tasks before clocking out",
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

      toast({
        title: "Clocked out successfully",
        description: "Have a great day!",
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
            },
          });
      }

      toast({
        title: "Early clock-out request submitted",
        description: "Waiting for manager approval",
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
      <div className="min-h-full bg-slate-50 p-6 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 max-w-md rounded-2xl bg-slate-200" />
          <div className="h-64 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  const { from: rangeFrom, to: rangeTo } = getEffectiveHistoryRange();
  const totalHoursDecimal = sumAttendanceHours(attendanceHistory);
  const totalHoursDisplay = formatTotalHours(totalHoursDecimal);
  const usingDefaultMonthRange = !historyDateFrom && !historyDateTo;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-slate-50 p-6 md:p-8">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Attendance</h1>
        <p className="text-slate-600">
          Manage your daily attendance
        </p>
      </div>

      <div className="grid min-h-0 w-full flex-1 gap-6 md:grid-cols-2 md:items-stretch md:min-h-[calc(100dvh-11rem)]">
        <Card className="flex h-full min-h-0 flex-col rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Clock in / out</CardTitle>
            <CardDescription>
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-6">
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 p-8">
              <div className="text-center">
                <Clock className="mx-auto mb-4 h-16 w-16 text-indigo-500" />
                <div className="mb-2 text-4xl font-black tabular-nums tracking-tight text-slate-900">
                  {user && formatInUserTimezone(new Date(), user.timezone, 'h:mm:ss a')}
                </div>
                <p className="text-sm text-slate-500">
                  {user?.timezone}
                </p>
              </div>
            </div>

            {attendance ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Clocked In</p>
                      <p className="text-sm text-muted-foreground">
                        {user && formatInUserTimezone(attendance.clock_in_time!, user.timezone, 'h:mm a')}
                      </p>
                    </div>
                  </div>
                  {attendance.is_late_request && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      attendance.approval_status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : attendance.approval_status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {attendance.approval_status}
                    </span>
                  )}
                </div>

                {attendance.clock_out_time ? (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">Clocked Out</p>
                      <p className="text-sm text-muted-foreground">
                        {user && formatInUserTimezone(attendance.clock_out_time, user.timezone, 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleClockOut}
                    disabled={actionLoading || attendance.approval_status === 'pending'}
                    className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 py-7 text-lg font-bold text-white shadow-lg transition hover:from-rose-600 hover:to-orange-600"
                  >
                    {actionLoading ? "Processing..." : "End session"}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 py-7 text-lg font-bold text-white shadow-lg transition hover:from-indigo-600 hover:to-violet-600"
                size="lg"
              >
                {actionLoading ? "Processing..." : "Begin your day"}
              </Button>
            )}

            {user && isAfterCutoff(user.timezone, '09:15') && !attendance && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  It's past 9:15 AM. You'll need to provide a reason for late clock-in.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full min-h-0 flex-col rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="shrink-0">
            <CardTitle className="text-xl">Attendance history</CardTitle>
            <CardDescription>
              {usingDefaultMonthRange
                ? `Showing this month through today (${format(parse(rangeFrom, "yyyy-MM-dd", new Date()), "MMM d")} – ${format(parse(rangeTo, "yyyy-MM-dd", new Date()), "MMM d, yyyy")}). Set dates below to use a custom range.`
                : `Showing ${format(parse(rangeFrom, "yyyy-MM-dd", new Date()), "MMM d, yyyy")} – ${format(parse(rangeTo, "yyyy-MM-dd", new Date()), "MMM d, yyyy")}.`}
            </CardDescription>
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
                <div className="inline-flex w-fit max-w-full items-baseline gap-2 rounded-md border border-border px-3 py-1.5">
                  <span className="text-sm text-muted-foreground">Total Hours:</span>
                  <span className="text-sm font-medium tabular-nums">{totalHoursDisplay}</span>
                </div>
                <p className="text-xs text-muted-foreground sm:text-right max-w-[220px]">
                  {attendanceHistory.filter((r) => r.clock_in_time && r.clock_out_time).length} complete
                  shift(s) in range; days without clock-out are excluded.
                </p>
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
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
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
              Please provide a reason for clocking in after 9:15 AM
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
