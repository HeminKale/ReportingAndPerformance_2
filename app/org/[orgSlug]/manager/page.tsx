"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Users } from "lucide-react";
import type { TaskLog, Attendance, Leave, User } from "@/lib/types/database";

export default function ManagerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [pendingTaskLogs, setPendingTaskLogs] = useState<any[]>([]);
  const [pendingAttendance, setPendingAttendance] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: 'task' | 'attendance' | 'leave' | null;
    item: any;
    action: 'approve' | 'reject' | null;
  }>({
    open: false,
    type: null,
    item: null,
    action: null,
  });
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

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

    if (userData?.role !== 'admin' && userData?.role !== 'manager') {
      toast({
        title: "Access denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      return;
    }

    const { data: team } = await supabase
      .from('users')
      .select('*')
      .eq('manager_id', authUser.id);

    const teamIds = team?.map(m => m.id) || [];

    const { data: taskLogs } = await supabase
      .from('task_logs')
      .select('*, tasks(*), users(*)')
      .in('user_id', teamIds)
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false });

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, users(*)')
      .in('user_id', teamIds)
      .eq('is_late_request', true)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    const { data: leaves } = await supabase
      .from('leaves')
      .select('*, users(*)')
      .in('user_id', teamIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    setUser(userData);
    setTeamMembers(team || []);
    setPendingTaskLogs(taskLogs || []);
    setPendingAttendance(attendance || []);
    setPendingLeaves(leaves || []);
    setLoading(false);
  };

  const handleAction = async () => {
    if (!user || !actionDialog.item || !actionDialog.action) return;

    setActionLoading(true);

    try {
      if (actionDialog.type === 'task') {
        const { error } = await supabase
          .from('task_logs')
          .update({
            verification_status: actionDialog.action === 'approve' ? 'approved' : 'rejected',
            verified_by: user.id,
            verified_at: new Date().toISOString(),
          })
          .eq('id', actionDialog.item.id);

        if (error) throw error;

        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: actionDialog.item.user_id,
            type: actionDialog.action === 'approve' ? 'task_verification' : 'task_rejected',
            title: `Task ${actionDialog.action === 'approve' ? 'Approved' : 'Rejected'}`,
            message: `Your task "${actionDialog.item.tasks.title}" has been ${actionDialog.action === 'approve' ? 'approved' : 'rejected'}${comment ? `: ${comment}` : ''}`,
          });
      } else if (actionDialog.type === 'attendance') {
        const { error } = await supabase
          .from('attendance')
          .update({
            approval_status: actionDialog.action === 'approve' ? 'approved' : 'rejected',
            approved_by: user.id,
            manager_comment: comment || null,
          })
          .eq('id', actionDialog.item.id);

        if (error) throw error;

        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: actionDialog.item.user_id,
            type: 'late_request',
            title: `Late Clock-In ${actionDialog.action === 'approve' ? 'Approved' : 'Rejected'}`,
            message: `Your late clock-in request has been ${actionDialog.action === 'approve' ? 'approved' : 'rejected'}${comment ? `: ${comment}` : ''}`,
          });
      } else if (actionDialog.type === 'leave') {
        const { error } = await supabase
          .from('leaves')
          .update({
            status: actionDialog.action === 'approve' ? 'approved' : 'rejected',
            approved_by: user.id,
            manager_comment: comment || null,
          })
          .eq('id', actionDialog.item.id);

        if (error) throw error;

        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: actionDialog.item.user_id,
            type: 'leave_approval',
            title: `Leave ${actionDialog.action === 'approve' ? 'Approved' : 'Rejected'}`,
            message: `Your leave request has been ${actionDialog.action === 'approve' ? 'approved' : 'rejected'}${comment ? `: ${comment}` : ''}`,
          });
      }

      toast({
        title: "Success",
        description: `Request ${actionDialog.action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      setActionDialog({ open: false, type: null, item: null, action: null });
      setComment("");
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
        <h1 className="text-3xl font-bold">Manager Panel</h1>
        <p className="text-muted-foreground">
          Manage your team and approve requests
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Team Members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Tasks
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTaskLogs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Pending
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingTaskLogs.length + pendingAttendance.length + pendingLeaves.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tasks">Task Verifications ({pendingTaskLogs.length})</TabsTrigger>
          <TabsTrigger value="attendance">Attendance ({pendingAttendance.length})</TabsTrigger>
          <TabsTrigger value="leaves">Leaves ({pendingLeaves.length})</TabsTrigger>
          <TabsTrigger value="team">Team Members ({teamMembers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          {pendingTaskLogs.length > 0 ? (
            pendingTaskLogs.map((log) => (
              <Card key={log.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{log.tasks.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {log.users.full_name} - {format(new Date(log.date), 'MMM d, yyyy')}
                      </CardDescription>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      log.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {log.status === 'completed' ? 'Comment:' : 'Reason:'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.status === 'completed' ? log.comment : log.reason}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setActionDialog({
                          open: true,
                          type: 'task',
                          item: log,
                          action: 'approve',
                        })}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setActionDialog({
                          open: true,
                          type: 'task',
                          item: log,
                          action: 'reject',
                        })}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No pending task verifications
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          {pendingAttendance.length > 0 ? (
            pendingAttendance.map((att) => (
              <Card key={att.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{att.users.full_name}</CardTitle>
                  <CardDescription>
                    Late clock-in on {format(new Date(att.date), 'MMM d, yyyy')} at {format(new Date(att.clock_in_time), 'h:mm a')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Reason:</p>
                      <p className="text-sm text-muted-foreground">{att.late_reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setActionDialog({
                          open: true,
                          type: 'attendance',
                          item: att,
                          action: 'approve',
                        })}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setActionDialog({
                          open: true,
                          type: 'attendance',
                          item: att,
                          action: 'reject',
                        })}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No pending attendance approvals
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaves" className="space-y-4">
          {pendingLeaves.length > 0 ? (
            pendingLeaves.map((leave) => (
              <Card key={leave.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{leave.users.full_name}</CardTitle>
                  <CardDescription>
                    {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d, yyyy')} ({leave.type.replace('_', ' ')})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Reason:</p>
                      <p className="text-sm text-muted-foreground">{leave.reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setActionDialog({
                          open: true,
                          type: 'leave',
                          item: leave,
                          action: 'approve',
                        })}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setActionDialog({
                          open: true,
                          type: 'leave',
                          item: leave,
                          action: 'reject',
                        })}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No pending leave requests
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {teamMembers.length > 0 ? (
            teamMembers.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{member.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Role: {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No team members assigned
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={actionDialog.open} onOpenChange={(open) => {
        if (!open) {
          setActionDialog({ open: false, type: null, item: null, action: null });
          setComment("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'approve' ? 'Approve' : 'Reject'} Request
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'reject' 
                ? 'Please provide a reason for rejection' 
                : 'Add an optional comment'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comment">
                Comment {actionDialog.action === 'reject' ? '(required)' : '(optional)'}
              </Label>
              <Textarea
                id="comment"
                placeholder="Add your comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required={actionDialog.action === 'reject'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setActionDialog({ open: false, type: null, item: null, action: null });
              setComment("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAction} 
              disabled={actionLoading || (actionDialog.action === 'reject' && !comment.trim())}
              variant={actionDialog.action === 'approve' ? 'default' : 'destructive'}
            >
              {actionLoading ? "Processing..." : actionDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
