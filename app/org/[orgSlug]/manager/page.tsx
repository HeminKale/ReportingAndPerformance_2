"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskLog, Attendance, Leave, User } from "@/lib/types/database";

export default function ManagerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [taskLogs, setTaskLogs] = useState<any[]>([]);
  const [attendanceItems, setAttendanceItems] = useState<any[]>([]);
  const [leaveItems, setLeaveItems] = useState<any[]>([]);
  const [teamTasks, setTeamTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSearchTerm, setCurrentSearchTerm] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
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
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    fetchData();
    
    const taskLogsChannel = supabase
      .channel('manager-task-logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_logs' },
        () => fetchData()
      )
      .subscribe();

    const attendanceChannel = supabase
      .channel('manager-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => fetchData()
      )
      .subscribe();

    const leavesChannel = supabase
      .channel('manager-leaves')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaves' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskLogsChannel);
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(leavesChannel);
    };
  }, []);

  const fetchData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userData?.role !== 'manager' && userData?.role !== 'admin') {
      toast({
        title: "Access denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      return;
    }

    const { data: team, error: teamError } = await supabase
      .from('users')
      .select('*')
      .eq('manager_id', authUser.id);

    if (teamError) console.error('[Manager] team fetch error:', teamError);

    const teamIds = team?.map(m => m.id) || [];
    console.log('[Manager] authUser.id:', authUser.id, '| teamIds:', teamIds);

    if (!teamIds.length) {
      setUser(userData);
      setTeamMembers([]);
      setTaskLogs([]);
      setAttendanceItems([]);
      setLeaveItems([]);
      setTeamTasks([]);
      setLoading(false);
      return;
    }

    const { data: logs, error: logsError } = await supabase
      .from('task_logs')
      .select('*, tasks(*), users!user_id(*)')
      .in('user_id', teamIds)
      .order('created_at', { ascending: false });

    if (logsError) console.error('[Manager] task_logs fetch error:', logsError);
    console.log('[Manager] task_logs count:', logs?.length ?? 0, '| sample:', logs?.[0]);

    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('*, users!user_id(*)')
      .in('user_id', teamIds)
      .eq('is_late_request', true)
      .order('created_at', { ascending: false });

    if (attError) console.error('[Manager] attendance fetch error:', attError);

    const { data: leaves, error: leavesError } = await supabase
      .from('leaves')
      .select('*, users!user_id(*)')
      .in('user_id', teamIds)
      .order('created_at', { ascending: false });

    if (leavesError) console.error('[Manager] leaves fetch error:', leavesError);

    const tasksOrFilter = teamIds.length > 0
      ? `is_common_task.eq.true,assigned_to.in.(${teamIds.join(',')})`
      : `is_common_task.eq.true`;

    const { data: assignedTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .eq('is_active', true)
      .or(tasksOrFilter);

    setUser(userData);
    setTeamMembers(team || []);
    setTaskLogs(logs || []);
    setAttendanceItems(attendance || []);
    setLeaveItems(leaves || []);
    setTeamTasks(assignedTasks || []);
    setLoading(false);
  };

  const toDayString = (value?: string | null) => {
    if (!value) return "";
    return format(new Date(value), "yyyy-MM-dd");
  };

  const matchesName = (fullName?: string, term?: string) => {
    if (!term) return true;
    return (fullName || "").toLowerCase().includes(term.toLowerCase());
  };

  const matchesHistoryFilters = (fullName: string | undefined, dateValue?: string | null) => {
    const nameOk = matchesName(fullName, historySearchTerm);
    if (!historyDateFilter) return nameOk;
    return nameOk && toDayString(dateValue) === historyDateFilter;
  };

  const getTaskDay = (log: any) => log.date || toDayString(log.created_at);
  const getAttendanceDay = (att: any) => att.date || toDayString(att.created_at);
  const getLeaveDay = (leave: any) => toDayString(leave.created_at);

  const groupByDay = (items: any[], getDayFn: (item: any) => string): [string, any[]][] => {
    const groups: Record<string, any[]> = {};
    for (const item of items) {
      const day = getDayFn(item);
      if (!groups[day]) groups[day] = [];
      groups[day].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  };

  // Today's Task: derive which tasks are due today per team member
  const todayWeekday = new Date().getDay();
  const dueTodayTasks = teamTasks.filter((task: any) => {
    if (task.type === 'daily') return true;
    if (task.type === 'weekly') return task.day_of_week === todayWeekday;
    if (task.type === 'monthly') return task.due_date === today;
    return false;
  });

  const todayTaskRows = dueTodayTasks.flatMap((task: any) => {
    const relevantMembers = task.is_common_task
      ? teamMembers
      : teamMembers.filter((m: User) => m.id === task.assigned_to);
    return relevantMembers.map((member: User) => {
      const log = taskLogs.find((l: any) => l.task_id === task.id && l.user_id === member.id);
      const status = !log
        ? 'Not Submitted'
        : log.verification_status === 'approved'
        ? 'Approved'
        : log.verification_status === 'rejected'
        ? 'Rejected'
        : 'Pending Approval';
      return { member, task, log, status };
    });
  });

  const todayTasksByEmployee: Record<string, typeof todayTaskRows> = {};
  for (const row of todayTaskRows) {
    const key = row.member.full_name;
    if (!todayTasksByEmployee[key]) todayTasksByEmployee[key] = [];
    todayTasksByEmployee[key].push(row);
  }
  const sortedTodayGroups = Object.entries(todayTasksByEmployee).sort(([a], [b]) => a.localeCompare(b));

  const currentTaskLogs = taskLogs.filter((log) =>
    getTaskDay(log) === today &&
    matchesName(log.users?.full_name, currentSearchTerm)
  );
  const historyTaskLogs = taskLogs.filter((log) =>
    getTaskDay(log) < today &&
    matchesHistoryFilters(log.users?.full_name, getTaskDay(log))
  );

  const currentAttendanceItems = attendanceItems.filter((att) =>
    getAttendanceDay(att) === today &&
    matchesName(att.users?.full_name, currentSearchTerm)
  );
  const historyAttendanceItems = attendanceItems.filter((att) =>
    getAttendanceDay(att) < today &&
    matchesHistoryFilters(att.users?.full_name, getAttendanceDay(att))
  );

  const currentLeaveItems = leaveItems.filter((leave) =>
    getLeaveDay(leave) === today &&
    matchesName(leave.users?.full_name, currentSearchTerm)
  );
  const historyLeaveItems = leaveItems.filter((leave) =>
    getLeaveDay(leave) < today &&
    matchesHistoryFilters(leave.users?.full_name, getLeaveDay(leave))
  );

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
            <div className="text-2xl font-bold">
              {taskLogs.filter(log => log.verification_status === 'pending').length}
            </div>
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
              {taskLogs.filter(log => log.verification_status === 'pending').length +
                attendanceItems.filter(att => att.approval_status === 'pending').length +
                leaveItems.filter(leave => leave.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today" className="space-y-6">
        <TabsList>
          <TabsTrigger value="today">Today's Task ({todayTaskRows.length})</TabsTrigger>
          <TabsTrigger value="tasks">Task Verifications ({taskLogs.length})</TabsTrigger>
          <TabsTrigger value="attendance">Attendance ({attendanceItems.length})</TabsTrigger>
          <TabsTrigger value="leaves">Leaves ({leaveItems.length})</TabsTrigger>
          <TabsTrigger value="team">Team Members ({teamMembers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          {sortedTodayGroups.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No tasks due today for your team</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {sortedTodayGroups.map(([employeeName, rows]) => (
                <details key={employeeName} className="rounded-lg border">
                  <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                    {employeeName} &mdash; {rows.length} task{rows.length !== 1 ? 's' : ''}
                  </summary>
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Task Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const statusClass =
                            row.status === 'Approved' ? 'bg-green-100 text-green-800' :
                            row.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            row.status === 'Pending Approval' ? 'bg-yellow-100 text-yellow-800' : '';
                          return (
                            <TableRow key={`${row.member.id}-${row.task.id}`}>
                              <TableCell>{row.member.full_name}</TableCell>
                              <TableCell className="font-medium">{row.task.title}</TableCell>
                              <TableCell className="max-w-md">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {row.task.description || '-'}
                                </p>
                              </TableCell>
                              <TableCell>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize">
                                  {row.task.type}
                                </span>
                              </TableCell>
                              <TableCell>
                                {row.task.is_numeric_task ? (
                                  row.log?.numeric_value != null ? (
                                    <span className="text-sm">
                                      {row.log.numeric_value} {row.task.numeric_unit || "units"}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusClass}>{row.status}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Tabs defaultValue="current" className="space-y-4">
            <TabsList>
              <TabsTrigger value="current">Current ({currentTaskLogs.length})</TabsTrigger>
              <TabsTrigger value="history">History ({historyTaskLogs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              <Input
                placeholder="Search by employee name..."
                value={currentSearchTerm}
                onChange={(e) => setCurrentSearchTerm(e.target.value)}
                className="max-w-md"
              />
              {currentTaskLogs.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTaskLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{log.users?.full_name}</TableCell>
                          <TableCell>{log.tasks?.title}</TableCell>
                          <TableCell className="capitalize">{log.status}</TableCell>
                          <TableCell>
                            {log.tasks?.is_numeric_task ? (
                              log.numeric_value != null ? (
                                <span className="text-sm">
                                  {log.numeric_value} {log.tasks?.numeric_unit || "units"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="capitalize">{log.verification_status}</TableCell>
                          <TableCell>
                            {log.submitted_at ? format(new Date(log.submitted_at), "HH:mm dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            {log.verification_status === "pending" ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => setActionDialog({ open: true, type: "task", item: log, action: "approve" })}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setActionDialog({ open: true, type: "task", item: log, action: "reject" })}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Card><CardContent className="p-6 text-center text-muted-foreground">No current task requests</CardContent></Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Search by employee name..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-44"
                />
              </div>
              {(() => {
                const groups = groupByDay(historyTaskLogs, getTaskDay);
                if (groups.length === 0) {
                  return <Card><CardContent className="p-6 text-center text-muted-foreground">No task history</CardContent></Card>;
                }
                return (
                  <div className="space-y-2">
                    {groups.map(([date, logs]) => (
                      <details key={date} className="rounded-lg border">
                        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                          {format(new Date(date), 'dd MMM yyyy')} &mdash; {logs.length} submission{logs.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Task</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Number</TableHead>
                                <TableHead>Verification</TableHead>
                                <TableHead>Submitted At</TableHead>
                                <TableHead>Verified At</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {logs.map((log: any) => (
                                <TableRow key={log.id}>
                                  <TableCell>{log.users?.full_name}</TableCell>
                                  <TableCell>{log.tasks?.title}</TableCell>
                                  <TableCell className="capitalize">{log.status}</TableCell>
                                  <TableCell>
                                    {log.tasks?.is_numeric_task ? (
                                      log.numeric_value != null ? (
                                        <span className="text-sm">
                                          {log.numeric_value} {log.tasks?.numeric_unit || "units"}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="capitalize">{log.verification_status}</TableCell>
                                  <TableCell>{log.submitted_at ? format(new Date(log.submitted_at), "HH:mm dd/MM/yyyy") : "-"}</TableCell>
                                  <TableCell>{log.verified_at ? format(new Date(log.verified_at), "HH:mm dd/MM/yyyy") : "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </details>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Tabs defaultValue="current" className="space-y-4">
            <TabsList>
              <TabsTrigger value="current">Current ({currentAttendanceItems.length})</TabsTrigger>
              <TabsTrigger value="history">History ({historyAttendanceItems.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              <Input
                placeholder="Search by employee name..."
                value={currentSearchTerm}
                onChange={(e) => setCurrentSearchTerm(e.target.value)}
                className="max-w-md"
              />
              {currentAttendanceItems.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAttendanceItems.map((att) => (
                        <TableRow key={att.id}>
                          <TableCell>{att.users?.full_name}</TableCell>
                          <TableCell>{format(new Date(att.date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{att.clock_in_time ? format(new Date(att.clock_in_time), "HH:mm dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{att.late_reason || "-"}</TableCell>
                          <TableCell className="capitalize">{att.approval_status}</TableCell>
                          <TableCell>
                            {att.approval_status === "pending" ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => setActionDialog({ open: true, type: "attendance", item: att, action: "approve" })}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: "attendance", item: att, action: "reject" })}>
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Card><CardContent className="p-6 text-center text-muted-foreground">No current attendance requests</CardContent></Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Search by employee name..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-44"
                />
              </div>
              {(() => {
                const groups = groupByDay(historyAttendanceItems, getAttendanceDay);
                if (groups.length === 0) {
                  return <Card><CardContent className="p-6 text-center text-muted-foreground">No attendance history</CardContent></Card>;
                }
                return (
                  <div className="space-y-2">
                    {groups.map(([date, items]) => (
                      <details key={date} className="rounded-lg border">
                        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                          {format(new Date(date), 'dd MMM yyyy')} &mdash; {items.length} request{items.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Manager Comment</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((att: any) => (
                                <TableRow key={att.id}>
                                  <TableCell>{att.users?.full_name}</TableCell>
                                  <TableCell>{format(new Date(att.date), "dd/MM/yyyy")}</TableCell>
                                  <TableCell>{att.late_reason || "-"}</TableCell>
                                  <TableCell className="capitalize">{att.approval_status}</TableCell>
                                  <TableCell>{att.manager_comment || "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </details>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="leaves" className="space-y-4">
          <Tabs defaultValue="current" className="space-y-4">
            <TabsList>
              <TabsTrigger value="current">Current ({currentLeaveItems.length})</TabsTrigger>
              <TabsTrigger value="history">History ({historyLeaveItems.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              <Input
                placeholder="Search by employee name..."
                value={currentSearchTerm}
                onChange={(e) => setCurrentSearchTerm(e.target.value)}
                className="max-w-md"
              />
              {currentLeaveItems.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Range</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLeaveItems.map((leave) => (
                        <TableRow key={leave.id}>
                          <TableCell>{leave.users?.full_name}</TableCell>
                          <TableCell>
                            {format(new Date(leave.start_date), "dd/MM/yyyy")} - {format(new Date(leave.end_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="capitalize">{leave.leave_type}</TableCell>
                          <TableCell>{leave.reason}</TableCell>
                          <TableCell className="capitalize">{leave.status}</TableCell>
                          <TableCell>
                            {leave.status === "pending" ? (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => setActionDialog({ open: true, type: "leave", item: leave, action: "approve" })}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: "leave", item: leave, action: "reject" })}>
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Card><CardContent className="p-6 text-center text-muted-foreground">No current leave requests</CardContent></Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Search by employee name..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-44"
                />
              </div>
              {(() => {
                const groups = groupByDay(historyLeaveItems, getLeaveDay);
                if (groups.length === 0) {
                  return <Card><CardContent className="p-6 text-center text-muted-foreground">No leave history</CardContent></Card>;
                }
                return (
                  <div className="space-y-2">
                    {groups.map(([date, items]) => (
                      <details key={date} className="rounded-lg border">
                        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                          {format(new Date(date), 'dd MMM yyyy')} &mdash; {items.length} request{items.length !== 1 ? 's' : ''}
                        </summary>
                        <div className="border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Range</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Manager Comment</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((leave: any) => (
                                <TableRow key={leave.id}>
                                  <TableCell>{leave.users?.full_name}</TableCell>
                                  <TableCell>
                                    {format(new Date(leave.start_date), "dd/MM/yyyy")} - {format(new Date(leave.end_date), "dd/MM/yyyy")}
                                  </TableCell>
                                  <TableCell className="capitalize">{leave.leave_type}</TableCell>
                                  <TableCell className="capitalize">{leave.status}</TableCell>
                                  <TableCell>{leave.manager_comment || "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </details>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {teamMembers.filter(member =>
            member.full_name.toLowerCase().includes(currentSearchTerm.toLowerCase())
          ).length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers
                    .filter(member => member.full_name.toLowerCase().includes(currentSearchTerm.toLowerCase()))
                    .map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{member.full_name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell className="capitalize">{member.role}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No team members assigned</CardContent></Card>
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
