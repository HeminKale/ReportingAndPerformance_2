"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { format } from "date-fns";
import { isAfterCutoff, formatInUserTimezone } from "@/lib/utils/timezone";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import type { Attendance, User } from "@/lib/types/database";

export default function AttendancePage() {
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [lateDialogOpen, setLateDialogOpen] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();
  const today = format(new Date(), 'yyyy-MM-dd');

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

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('date', today)
      .single();

    setUser(userData);
    setAttendance(attendanceData);
    setLoading(false);
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

      fetchData();
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
      const { error } = await supabase
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
      fetchData();
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
      const { data: incompleteTasks } = await supabase
        .from('task_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .neq('status', 'completed');

      const { data: allTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', user.organization_id)
        .or(`assigned_to.eq.${user.id},is_common_task.eq.true`)
        .eq('is_active', true)
        .eq('type', 'daily');

      const submittedTaskIds = new Set(
        (await supabase
          .from('task_logs')
          .select('task_id')
          .eq('user_id', user.id)
          .eq('date', today)
        ).data?.map(log => log.task_id) || []
      );

      const unsubmittedTasks = allTasks?.filter(task => !submittedTaskIds.has(task.id)) || [];

      if (unsubmittedTasks.length > 0) {
        toast({
          title: "Cannot clock out",
          description: "Please complete or mark all daily tasks before clocking out",
          variant: "destructive",
        });
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

      fetchData();
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
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-muted-foreground">
          Manage your daily attendance
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clock In/Out</CardTitle>
            <CardDescription>
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
              <div className="text-center">
                <Clock className="h-16 w-16 mx-auto mb-4 text-primary" />
                <div className="text-4xl font-bold mb-2">
                  {user && formatInUserTimezone(new Date(), user.timezone, 'h:mm:ss a')}
                </div>
                <p className="text-sm text-muted-foreground">
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
                    className="w-full"
                    variant="destructive"
                  >
                    {actionLoading ? "Processing..." : "Clock Out"}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="w-full"
                size="lg"
              >
                {actionLoading ? "Processing..." : "Clock In"}
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

        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>
              Your recent attendance records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Attendance history will be displayed here
            </p>
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
    </div>
  );
}
