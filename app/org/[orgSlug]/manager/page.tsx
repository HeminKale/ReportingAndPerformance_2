"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { format } from "date-fns";
import { Clock, Users, AlertTriangle, Plus, Pencil, Trash2, ChevronDown, ChevronUp, MoreVertical } from "lucide-react";
import { TaskAssignmentPanel } from "@/components/shared/task-assignment-panel";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ManagerPeriodicTask, Task, TaskLog, Attendance, Leave, User } from "@/lib/types/database";
import { SharedNumericTasksAccordion } from "@/components/manager/shared-numeric-tasks-accordion";
import { cn } from "@/lib/utils/cn";
import { ManagerDocumentsTab } from "@/components/manager/manager-documents-tab";
import { ManagerSalaryTab } from "@/components/manager/manager-salary-tab";
import { ManagerCalendarTab } from "@/components/manager/manager-calendar-tab";
import { ManagerEmployeeRatingsTab } from "@/components/manager/manager-employee-ratings-tab";
import { markResourceNotificationsRead } from "@/lib/notifications/mark-resource-read";
import { requestNotificationsBellRefresh } from "@/lib/notifications/refresh-bell";

export default function ManagerPage() {
  const { orgSlug } = useParams() as { orgSlug: string };
  const [user, setUser] = useState<User | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [taskLogs, setTaskLogs] = useState<any[]>([]);
  const [attendanceItems, setAttendanceItems] = useState<any[]>([]);
  const [attendanceReportItems, setAttendanceReportItems] = useState<any[]>([]);
  const [allMistakes, setAllMistakes] = useState<any[]>([]);
  const [leaveItems, setLeaveItems] = useState<any[]>([]);
  const [teamTasks, setTeamTasks] = useState<any[]>([]);
  const [managedTeamTasks, setManagedTeamTasks] = useState<Task[]>([]);
  const [monthlyNumericLinkOptions, setMonthlyNumericLinkOptions] = useState<Task[]>([]);
  const [periodicTasks, setPeriodicTasks] = useState<ManagerPeriodicTask[]>([]);
  const monthlyPeriodicNumericLinkOptions = useMemo(
    () => periodicTasks.filter((t) => t.type === "monthly" && t.is_numeric_task && t.is_enabled),
    [periodicTasks]
  );
  const [loading, setLoading] = useState(true);
  const [currentSearchTerm, setCurrentSearchTerm] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyToDateFilter, setHistoryToDateFilter] = useState("");
  const [managerActiveTab, setManagerActiveTab] = useState("manager-tasks");
  const [tasksSubView, setTasksSubView] = useState<"regular" | "shared" | "history">("regular");
  const [regularEmployeeFilter, setRegularEmployeeFilter] = useState("");
  const [regularTaskFilter, setRegularTaskFilter] = useState("");
  const [sharedEmployeeFilter, setSharedEmployeeFilter] = useState("");
  const [sharedTaskFilter, setSharedTaskFilter] = useState("");
  const [taskHistoryEmployeeFilter, setTaskHistoryEmployeeFilter] = useState("");
  const [taskHistoryTaskFilter, setTaskHistoryTaskFilter] = useState("");
  const [taskHistoryDateFrom, setTaskHistoryDateFrom] = useState("");
  const [taskHistoryDateTo, setTaskHistoryDateTo] = useState("");
  const [expandedRegularRowKeys, setExpandedRegularRowKeys] = useState<Set<string>>(new Set());
  const [regularRowMenuKey, setRegularRowMenuKey] = useState<string | null>(null);
  const [taskHistoryRowMenuKey, setTaskHistoryRowMenuKey] = useState<string | null>(null);
  const [recallDialog, setRecallDialog] = useState<{ open: boolean; log: any | null }>({ open: false, log: null });
  const [recallComment, setRecallComment] = useState("");
  const [leavesSearchTerm, setLeavesSearchTerm] = useState("");
  const [leavesDateFilter, setLeavesDateFilter] = useState("");
  const [teamSearchTerm, setTeamSearchTerm] = useState("");
  const [mistakeSearchTerm, setMistakeSearchTerm] = useState("");
  const [expandedMistakeRows, setExpandedMistakeRows] = useState<Set<string>>(new Set());
  const [certGraphEmployeeFilter, setCertGraphEmployeeFilter] = useState("");
  const [certGraphMode, setCertGraphMode] = useState<"daily" | "monthly">("daily");
  const [selectedCertEmployeeIds, setSelectedCertEmployeeIds] = useState<string[]>([]);
  const [certGraphDropdownOpen, setCertGraphDropdownOpen] = useState(false);
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
  const [mistakeDialog, setMistakeDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    mistake: any | null;
  }>({
    open: false,
    mode: 'create',
    mistake: null,
  });
  const [mistakeForm, setMistakeForm] = useState({
    title: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    userId: '',
  });
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const CERT_GRAPH_MAX_EMPLOYEES = 10;
  const CERT_GRAPH_COLORS = [
    "#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626",
    "#0d9488", "#9333ea", "#db2777", "#4f46e5", "#65a30d",
  ];

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

    const tasksChannel = supabase
      .channel('manager-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => fetchData()
      )
      .subscribe();

    const periodicChannel = supabase
      .channel('manager-periodic-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'manager_periodic_tasks' },
        () => fetchData()
      )
      .subscribe();

    const mistakesChannel = supabase
      .channel('manager-mistakes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mistakes' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskLogsChannel);
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(leavesChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(periodicChannel);
      supabase.removeChannel(mistakesChannel);
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
      .rpc('get_all_subordinates', { manager_uuid: authUser.id });

    if (teamError) console.error('[Manager] team fetch error:', teamError);

    const teamIds = team?.map((m: { id: string }) => m.id) || [];
    console.log('[Manager] authUser.id:', authUser.id, '| teamIds:', teamIds);

    const [{ data: periodicRows }, { data: monthlyNumericOrg }] = await Promise.all([
      supabase
        .from('manager_periodic_tasks')
        .select('*')
        .eq('manager_id', authUser.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .eq('type', 'monthly')
        .eq('is_numeric_task', true),
    ]);
    setPeriodicTasks((periodicRows as ManagerPeriodicTask[]) || []);

    if (!teamIds.length) {
      setUser(userData);
      setTeamMembers([]);
      setTaskLogs([]);
      setAttendanceItems([]);
      setAttendanceReportItems([]);
      setAllMistakes([]);
      setLeaveItems([]);
      setTeamTasks([]);
      setManagedTeamTasks([]);
      setMonthlyNumericLinkOptions(monthlyNumericOrg || []);
      setLoading(false);
      return;
    }

    const { data: teamProfiles, error: teamProfilesError } = await supabase
      .from("users")
      .select("*")
      .in("id", teamIds)
      .order("full_name", { ascending: true });
    if (teamProfilesError) console.error("[Manager] team profiles fetch error:", teamProfilesError);

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

    const { data: attendanceReport, error: attReportError } = await supabase
      .from('attendance')
      .select('*, users!user_id(*)')
      .in('user_id', teamIds)
      .order('date', { ascending: false });

    if (attReportError) console.error('[Manager] attendance report fetch error:', attReportError);

    const { data: leaves, error: leavesError } = await supabase
      .from('leaves')
      .select('*, users!user_id(*)')
      .in('user_id', teamIds)
      .order('created_at', { ascending: false });

    if (leavesError) console.error('[Manager] leaves fetch error:', leavesError);

    const { data: mistakes, error: mistakesError } = await supabase
      .from('mistakes')
      .select('*, users!mistakes_user_id_fkey(full_name), added_by_user:users!mistakes_added_by_fkey(full_name)')
      .in('user_id', teamIds)
      .order('date', { ascending: false });

    if (mistakesError) console.error('[Manager] mistakes fetch error:', mistakesError);

    const tasksOrFilter = teamIds.length > 0
      ? `is_common_task.eq.true,assigned_to.in.(${teamIds.join(',')})`
      : `is_common_task.eq.true`;

    const { data: assignedTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .eq('is_active', true)
      .or(tasksOrFilter);

    const [managedRes, monthlyNumericRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .in('assigned_to', teamIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .eq('type', 'monthly')
        .eq('is_numeric_task', true),
    ]);

    setUser(userData);
    setTeamMembers((teamProfiles as User[]) || []);
    setTaskLogs(logs || []);
    setAttendanceItems(attendance || []);
    setAttendanceReportItems(attendanceReport || []);
    setAllMistakes(mistakes || []);
    setLeaveItems(leaves || []);
    setTeamTasks(assignedTasks || []);
    setManagedTeamTasks(managedRes.data || []);
    setMonthlyNumericLinkOptions(monthlyNumericRes.data || []);
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
    const d = dateValue ? toDayString(dateValue) : "";
    if (!historyDateFilter && !historyToDateFilter) return nameOk;
    if (historyDateFilter && historyToDateFilter) return nameOk && d >= historyDateFilter && d <= historyToDateFilter;
    if (historyDateFilter) return nameOk && d >= historyDateFilter;
    if (historyToDateFilter) return nameOk && d <= historyToDateFilter;
    return nameOk;
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

  const groupByEmployee = (items: any[]): [string, any[]][] => {
    const groups: Record<string, any[]> = {};
    for (const item of items) {
      const key = item.users?.full_name || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  const calculateHours = (clockIn: string | null, clockOut: string | null): string => {
    if (!clockIn || !clockOut) return '-';
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    if (diff <= 0) return '-';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const calculateTotalHours = (attendanceRecords: any[]): number => {
    let totalMs = 0;
    for (const att of attendanceRecords) {
      if (att.clock_in_time && att.clock_out_time) {
        const diff = new Date(att.clock_out_time).getTime() - new Date(att.clock_in_time).getTime();
        if (diff > 0) totalMs += diff;
      }
    }
    const hours = totalMs / (1000 * 60 * 60);
    return Math.round(hours * 10) / 10;
  };

  const getTasksCompleteForDate = (userId: string, date: string): string => {
    const logsForDate = taskLogs.filter((log: any) => 
      log.user_id === userId && getTaskDay(log) === date
    );
    const completed = logsForDate.filter((log: any) => log.verification_status === 'approved').length;
    return logsForDate.length > 0 ? `${completed}/${logsForDate.length}` : '0/0';
  };

  // Tasks → Regular: derive which tasks are due today per team member
  const todayTaskRows = useMemo(() => {
    const todayWeekday = new Date().getDay();
    
    // Part 1: Tasks due today
    const dueTodayTasks = teamTasks.filter((task: any) => {
      const createdToday = toDayString(task.created_at) === today;
      if (!createdToday) return false;
      if (task.type === "daily") return true;
      if (task.type === "weekly") return task.day_of_week === todayWeekday;
      if (task.type === "monthly") return task.due_date === today;
      return false;
    });

    const activeRows = dueTodayTasks.flatMap((task: any) => {
      const relevantMembers = task.is_common_task
        ? teamMembers
        : teamMembers.filter((m: User) => m.id === task.assigned_to);
      return relevantMembers.map((member: User) => {
        const log = taskLogs.find(
          (l: any) => l.task_id === task.id && l.user_id === member.id && getTaskDay(l) === today
        );
        const status = !log
          ? "Not Submitted"
          : log.verification_status === "approved"
            ? "Completed & verified"
            : log.verification_status === "rejected"
              ? "Rejected"
              : log.verification_status === "recalled"
                ? "Recalled"
                : "Pending Approval";
        return { member, task, log, status };
      });
    });

    // Part 2: Recalled tasks from the past
    const recalledPastLogs = taskLogs.filter((l: any) => 
      l.verification_status === 'recalled' && getTaskDay(l) !== today
    );

    const recalledRows = recalledPastLogs.map((log: any) => {
      const member = teamMembers.find(m => m.id === log.user_id);
      const task = log.tasks;
      if (!member || !task) return null;
      return { member, task, log, status: "Recalled" as const };
    }).filter(Boolean) as any[];

    return [...activeRows, ...recalledRows];
  }, [teamTasks, teamMembers, taskLogs, today]);

  const filteredTaskHistoryLogs = useMemo(() => {
    return taskLogs.filter((log: any) => {
      if (!matchesName(log.users?.full_name, taskHistoryEmployeeFilter)) return false;
      const title = (log.tasks?.title || "") as string;
      const tf = taskHistoryTaskFilter.trim().toLowerCase();
      if (tf && !title.toLowerCase().includes(tf)) return false;
      const day = getTaskDay(log);
      if (day > today) return false;
      const from = taskHistoryDateFrom;
      const to = taskHistoryDateTo;
      if (from && to) return day >= from && day <= to;
      if (from) return day >= from;
      if (to) return day <= to;
      return day <= today;
    });
  }, [
    taskLogs,
    taskHistoryEmployeeFilter,
    taskHistoryTaskFilter,
    taskHistoryDateFrom,
    taskHistoryDateTo,
    today,
  ]);

  const filteredTodayTaskRows = useMemo(() => {
    return todayTaskRows.filter(
      (row) =>
        matchesName(row.member.full_name, regularEmployeeFilter) &&
        (!regularTaskFilter.trim() ||
          (row.task.title || "").toLowerCase().includes(regularTaskFilter.trim().toLowerCase()))
    );
  }, [todayTaskRows, regularEmployeeFilter, regularTaskFilter]);

  const sortedTodayGroupsFiltered = useMemo(() => {
    const by: Record<string, (typeof todayTaskRows)[number][]> = {};
    for (const row of filteredTodayTaskRows) {
      const key = row.member.full_name;
      if (!by[key]) by[key] = [];
      by[key].push(row);
    }
    return Object.entries(by).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTodayTaskRows]);

  const currentAttendanceItems = attendanceItems.filter((att) =>
    getAttendanceDay(att) === today &&
    matchesName(att.users?.full_name, currentSearchTerm)
  );
  const historyAttendanceItems = attendanceItems.filter((att) =>
    getAttendanceDay(att) < today &&
    matchesHistoryFilters(att.users?.full_name, getAttendanceDay(att))
  );
  const currentAttendanceReportItems = attendanceReportItems.filter((att) =>
    getAttendanceDay(att) === today &&
    matchesName(att.users?.full_name, currentSearchTerm)
  );
  const historyAttendanceReportItems = attendanceReportItems.filter((att) =>
    getAttendanceDay(att) < today &&
    matchesHistoryFilters(att.users?.full_name, getAttendanceDay(att))
  );
  const mistakeMatchesSearch = (m: any) =>
    (m.title || '').toLowerCase().includes(mistakeSearchTerm.toLowerCase()) ||
    (m.description || '').toLowerCase().includes(mistakeSearchTerm.toLowerCase()) ||
    (m.users?.full_name || '').toLowerCase().includes(mistakeSearchTerm.toLowerCase());

  const filteredClosureRequests = allMistakes.filter(
    (m) => m.closure_request_pending === true && (m.status || 'open') === 'open' && mistakeMatchesSearch(m)
  );
  const filteredMistakes = allMistakes.filter(mistakeMatchesSearch);

  const toggleMistakeRow = (mistakeId: string) => {
    const newExpanded = new Set(expandedMistakeRows);
    if (newExpanded.has(mistakeId)) newExpanded.delete(mistakeId);
    else newExpanded.add(mistakeId);
    setExpandedMistakeRows(newExpanded);
  };

  const toggleRegularTaskRow = (rowKey: string) => {
    setExpandedRegularRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const openCreateMistakeDialog = () => {
    setMistakeForm({ title: '', description: '', severity: 'medium', userId: '' });
    setMistakeDialog({ open: true, mode: 'create', mistake: null });
  };

  const openEditMistakeDialog = (mistake: any) => {
    setMistakeForm({
      title: mistake.title || '',
      description: mistake.description || '',
      severity: mistake.severity || 'medium',
      userId: mistake.user_id || '',
    });
    setMistakeDialog({ open: true, mode: 'edit', mistake });
  };

  const handleCreateMistake = async () => {
    if (!user || !mistakeForm.title || !mistakeForm.userId) {
      toast({
        title: "Error",
        description: "Please fill in title and select an employee",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('mistakes')
        .insert({
          organization_id: user.organization_id,
          user_id: mistakeForm.userId,
          added_by: user.id,
          title: mistakeForm.title.trim(),
          description: mistakeForm.description,
          severity: mistakeForm.severity,
          date: new Date().toISOString().split('T')[0],
          status: 'open',
          closure_request_pending: false,
        });
      if (error) throw error;

      const tasksLink = `/org/${orgSlug}/tasks`;
      const { error: nErr } = await supabase.from("notifications").insert({
        organization_id: user.organization_id,
        user_id: mistakeForm.userId,
        type: "mistake_logged",
        title: "Mistake recorded",
        message: `Your manager logged a mistake: "${mistakeForm.title.trim()}"`,
        link: tasksLink,
        metadata: { actionable: false },
      });
      if (nErr) console.warn("mistake_logged notification", nErr.message);

      toast({ title: "Success", description: "Mistake recorded successfully" });
      setMistakeDialog({ open: false, mode: 'create', mistake: null });
      setMistakeForm({ title: '', description: '', severity: 'medium', userId: '' });
      await fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMistake = async () => {
    if (!mistakeDialog.mistake || !mistakeForm.title || !mistakeForm.userId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('mistakes')
        .update({
          title: mistakeForm.title.trim(),
          user_id: mistakeForm.userId,
          description: mistakeForm.description,
          severity: mistakeForm.severity,
        })
        .eq('id', mistakeDialog.mistake.id);
      if (error) throw error;
      toast({ title: "Success", description: "Mistake updated successfully" });
      setMistakeDialog({ open: false, mode: 'edit', mistake: null });
      setMistakeForm({ title: '', description: '', severity: 'medium', userId: '' });
      await fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMistake = async (mistakeId: string) => {
    if (!confirm('Are you sure you want to delete this mistake record?')) return;
    try {
      const { error } = await supabase.from('mistakes').delete().eq('id', mistakeId);
      if (error) throw error;
      toast({ title: "Success", description: "Mistake deleted successfully" });
      await fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleClosureAccept = async (mistakeId: string) => {
    if (!user) return;
    setActionLoading(true);
    try {
      const { data: mrow, error: selErr } = await supabase
        .from("mistakes")
        .select("user_id, title")
        .eq("id", mistakeId)
        .single();
      if (selErr) throw selErr;

      const { error } = await supabase
        .from('mistakes')
        .update({ status: 'rectified', closure_request_pending: false })
        .eq('id', mistakeId);
      if (error) throw error;

      const tasksLink = `/org/${orgSlug}/tasks`;
      const { error: nErr } = await supabase.from("notifications").insert({
        organization_id: user.organization_id,
        user_id: mrow.user_id,
        type: "mistake_rectified",
        title: "Mistake rectified",
        message: `Your rectification for "${mrow.title || "a mistake"}" was accepted by your manager.`,
        link: tasksLink,
        metadata: { actionable: false },
      });
      if (nErr) console.warn("mistake_rectified notification", nErr.message);

      toast({ title: "Success", description: "Closure accepted. Status set to Rectified." });
      await fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosureReject = async (mistakeId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('mistakes')
        .update({ closure_request_pending: false })
        .eq('id', mistakeId);
      if (error) throw error;
      toast({ title: "Closure request rejected", description: "The employee can submit a new request if needed." });
      await fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const currentLeaveItems = leaveItems.filter((leave) =>
    getLeaveDay(leave) === today &&
    matchesName(leave.users?.full_name, leavesSearchTerm)
  );
  const historyLeaveItems = leaveItems.filter((leave) => {
    const nameMatch = matchesName(leave.users?.full_name, leavesSearchTerm);
    const dayStr = getLeaveDay(leave);
    if (leavesDateFilter) {
      return dayStr === leavesDateFilter && nameMatch && dayStr < today;
    }
    return dayStr < today && nameMatch;
  });

  useEffect(() => {
    if (teamMembers.length === 0) {
      setSelectedCertEmployeeIds([]);
      return;
    }
    setSelectedCertEmployeeIds((prev) => {
      const valid = prev.filter((id) => teamMembers.some((m) => m.id === id));
      if (valid.length > 0) return valid;
      return teamMembers.slice(0, 3).map((m) => m.id);
    });
  }, [teamMembers]);

  const filteredCertGraphMembers = useMemo(() => {
    const term = certGraphEmployeeFilter.trim().toLowerCase();
    if (!term) return teamMembers;
    return teamMembers.filter((m) => m.full_name.toLowerCase().includes(term));
  }, [teamMembers, certGraphEmployeeFilter]);

  const certGraphData = useMemo(() => {
    const selectedSet = new Set(selectedCertEmployeeIds);

    const relevantLogs = taskLogs.filter((log: any) =>
      selectedSet.has(log.user_id) &&
      log.tasks?.is_numeric_task &&
      log.numeric_value != null &&
      log.date
    );

    if (certGraphMode === "daily") {
      const now = new Date();
      const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
      const byDate: Record<string, Record<string, number>> = {};

      for (const log of relevantLogs) {
        if (log.date < monthStart || log.date > monthEnd) continue;
        if (!byDate[log.date]) byDate[log.date] = {};
        byDate[log.date][log.user_id] = (byDate[log.date][log.user_id] || 0) + Number(log.numeric_value);
      }

      const sortedDates = Object.keys(byDate).sort((a, b) => a.localeCompare(b));
      return sortedDates.map((date) => {
        const row: Record<string, any> = {
          key: date,
          axisLabel: format(new Date(date), "dd MMM"),
          total: 0,
        };
        for (const userId of selectedCertEmployeeIds) {
          const value = byDate[date]?.[userId] || 0;
          row[userId] = value;
          row.total += value;
        }
        return row;
      });
    }

    const byMonth: Record<string, Record<string, number>> = {};
    for (const log of relevantLogs) {
      const monthKey = format(new Date(log.date), "yyyy-MM");
      if (!byMonth[monthKey]) byMonth[monthKey] = {};
      byMonth[monthKey][log.user_id] = (byMonth[monthKey][log.user_id] || 0) + Number(log.numeric_value);
    }

    const monthKeys: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(format(d, "yyyy-MM"));
    }

    return monthKeys.map((monthKey) => {
      const row: Record<string, any> = {
        key: monthKey,
        axisLabel: format(new Date(`${monthKey}-01`), "MMM yyyy"),
        total: 0,
      };
      for (const userId of selectedCertEmployeeIds) {
        const value = byMonth[monthKey]?.[userId] || 0;
        row[userId] = value;
        row.total += value;
      }
      return row;
    });
  }, [taskLogs, selectedCertEmployeeIds, teamMembers, certGraphMode]);

  const handleRecallConfirm = async () => {
    if (!user || !recallDialog.log) return;
    setActionLoading(true);
    try {
      const log = recallDialog.log;
      const note = recallComment.trim();
      const prev = (log.manager_review_comment && String(log.manager_review_comment).trim()) || "";
      const merged = prev
        ? `${prev}\n\nRecall: ${note || "(no additional comment)"}`
        : `Recall: ${note || "(no additional comment)"}`;

      const { error } = await supabase
        .from("task_logs")
        .update({
          verification_status: "recalled",
          verified_by: null,
          verified_at: null,
          manager_review_comment: merged,
        })
        .eq("id", log.id);

      if (error) throw error;

      const taskTitle = (log.tasks?.title as string) || "your task";
      await supabase.from("notifications").insert({
        organization_id: user.organization_id,
        user_id: log.user_id,
        type: "task_recalled",
        title: "Task submission recalled",
        message: `Your manager recalled a decision on "${taskTitle}".${note ? ` ${note}` : ""}`,
        link: `/org/${orgSlug}/tasks`,
        metadata: {
          actionable: false,
          resource_type: "task_log",
          resource_id: String(log.id),
          manager_comment: merged,
        },
      });

      requestNotificationsBellRefresh();
      toast({ title: "Recalled", description: "The employee has been notified." });
      setRecallDialog({ open: false, log: null });
      setRecallComment("");
      await fetchData();
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

  const handleAction = async () => {
    if (!user || !actionDialog.item || !actionDialog.action) return;

    setActionLoading(true);

    try {
      if (actionDialog.type === 'task') {
        const mgr = comment.trim();
        const { error } = await supabase
          .from('task_logs')
          .update({
            verification_status: actionDialog.action === 'approve' ? 'approved' : 'rejected',
            verified_by: user.id,
            verified_at: new Date().toISOString(),
            manager_review_comment: mgr || null,
          })
          .eq('id', actionDialog.item.id);

        if (error) throw error;

        await markResourceNotificationsRead(
          supabase,
          user.id,
          "task_log",
          String(actionDialog.item.id)
        );

        const taskTitle = actionDialog.item.tasks?.title as string;
        const notifType = actionDialog.action === "approve" ? "task_approved" : "task_rejected";
        const notifTitle =
          actionDialog.action === "approve" ? "Task approved" : "Task rejected";
        const notifMessage =
          actionDialog.action === "approve"
            ? `Your task "${taskTitle}" was approved.${mgr ? ` Manager comment: ${mgr}` : ""}`
            : `Your task "${taskTitle}" was rejected.${mgr ? ` Manager comment: ${mgr}` : ""}`;

        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: actionDialog.item.user_id,
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            link: `/org/${orgSlug}/tasks`,
            metadata: {
              actionable: false,
              resource_type: "task_log",
              resource_id: String(actionDialog.item.id),
              manager_comment: mgr || null,
            },
          });
        requestNotificationsBellRefresh();
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

        await markResourceNotificationsRead(
          supabase,
          user.id,
          "attendance",
          String(actionDialog.item.id)
        );

        const mgrC = comment.trim() || null;
        const isEarly = Boolean(
          (actionDialog.item as { is_late_request?: boolean; clock_in_time?: string; clock_out_time?: string | null })
            .clock_in_time && (actionDialog.item as { clock_out_time?: string | null }).clock_out_time
        );
        const attendanceTitle = isEarly
          ? `Early clock-out ${actionDialog.action === "approve" ? "approved" : "rejected"}`
          : `Late clock-in ${actionDialog.action === "approve" ? "approved" : "rejected"}`;

        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: actionDialog.item.user_id,
            type: 'late_request',
            title: attendanceTitle,
            message: isEarly
              ? `Your early clock-out request has been ${
                  actionDialog.action === "approve" ? "approved" : "rejected"
                }${mgrC ? `: ${mgrC}` : ""}`
              : `Your late clock-in request has been ${
                  actionDialog.action === "approve" ? "approved" : "rejected"
                }${mgrC ? `: ${mgrC}` : ""}`,
            link: `/org/${orgSlug}/attendance`,
            metadata: {
              actionable: false,
              resource_type: "attendance",
              resource_id: String(actionDialog.item.id),
              manager_comment: mgrC,
            },
          });
        requestNotificationsBellRefresh();
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

        await markResourceNotificationsRead(
          supabase,
          user.id,
          "leave",
          String(actionDialog.item.id)
        );

        const leaveMgrC = comment.trim() || null;
        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: actionDialog.item.user_id,
            type: 'leave_approval',
            title: `Leave ${actionDialog.action === 'approve' ? 'Approved' : 'Rejected'}`,
            message: `Your leave request has been ${
              actionDialog.action === 'approve' ? 'approved' : 'rejected'
            }${leaveMgrC ? `: ${leaveMgrC}` : ''}`,
            link: `/org/${orgSlug}/leaves`,
            metadata: {
              actionable: false,
              resource_type: "leave",
              resource_id: String(actionDialog.item.id),
              manager_comment: leaveMgrC,
            },
          });
        requestNotificationsBellRefresh();
      }

      toast({
        title: "Success",
        description: `Request ${actionDialog.action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      setActionDialog({ open: false, type: null, item: null, action: null });
      setComment("");
      await fetchData();
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
      <div className="p-6 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="option-surface space-y-6 p-6 md:p-8">
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

      <Tabs value={managerActiveTab} onValueChange={setManagerActiveTab} className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row">          <aside className="h-fit flex w-full shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-2 shadow-sm xl:w-72">
            <div className="px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Manager Panel</h2>
            </div>
            <TabsList className="flex h-auto flex-col gap-1.5 bg-transparent p-0">
              <div className="flex w-full flex-col gap-1.5">
                <TabsTrigger 
                  value="manager-tasks" 
                  className={cn(
                    "group flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-300 shadow-none",
                    "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    "data-[state=active]:translate-x-1 data-[state=active]:scale-[1.02] data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1),0_4px_8px_-2px_rgba(0,0,0,0.05)] data-[state=active]:ring-1 data-[state=active]:ring-slate-200/50"
                  )}
                >
                  <span>Tasks</span>
                  {taskLogs.filter((log: any) => log.verification_status === 'pending').length > 0 && (
                    <span className={cn(
                      "rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums transition-colors",
                      "bg-amber-100/80 text-amber-700 group-hover:bg-amber-200",
                      "group-data-[state=active]:bg-amber-100 group-data-[state=active]:text-amber-700"
                    )}>
                      {taskLogs.filter((log: any) => log.verification_status === 'pending').length}
                    </span>
                  )}
                </TabsTrigger>
                {managerActiveTab === "manager-tasks" && (
                  <div className="mx-2 flex flex-col gap-1 border-l-2 border-slate-200/50 pl-3 pb-1">
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150",
                        tasksSubView === "regular"
                          ? "bg-primary/5 text-primary"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      )}
                      onClick={() => setTasksSubView("regular")}
                    >
                      Regular
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150",
                        tasksSubView === "shared"
                          ? "bg-primary/5 text-primary"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      )}
                      onClick={() => setTasksSubView("shared")}
                    >
                      Shared
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150",
                        tasksSubView === "history"
                          ? "bg-primary/5 text-primary"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      )}
                      onClick={() => setTasksSubView("history")}
                    >
                      History
                    </button>
                  </div>
                )}
              </div>

              {[
                { value: "attendance-report", label: "Attendance Report", count: attendanceItems.filter((att: any) => att.approval_status === 'pending').length },
                { value: "mistakes", label: "Track Mistakes", count: allMistakes.filter((m: any) => m.closure_request_pending === true).length },
                { value: "leaves", label: "Leaves", count: leaveItems.filter((leave: any) => leave.status === 'pending').length },
                { value: "calendar", label: "Calendar" },
                { value: "team", label: "Team Members", count: teamMembers.length, alwaysShowCount: true },
                { value: "documents", label: "Documents" },
                { value: "salary", label: "Salary" },
                { value: "ratings", label: "Employee Ratings" },
                { value: "task-assignment", label: "Task Assignment" },
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className={cn(
                    "group flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-300 shadow-none",
                    "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    "data-[state=active]:translate-x-1 data-[state=active]:scale-[1.02] data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1),0_4px_8px_-2px_rgba(0,0,0,0.05)] data-[state=active]:ring-1 data-[state=active]:ring-slate-200/50"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (tab.alwaysShowCount || tab.count > 0) && (
                    <span className={cn(
                      "rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums transition-colors",
                      tab.alwaysShowCount 
                        ? "bg-slate-200/50 text-slate-500 group-hover:bg-slate-200 group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary"
                        : "bg-amber-100/80 text-amber-700 group-hover:bg-amber-200 group-data-[state=active]:bg-amber-100 group-data-[state=active]:text-amber-700"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </aside>

          <section className="option-panel min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <TabsContent value="manager-tasks" className="space-y-4">
          {tasksSubView === "regular" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Filter by employee name..."
                  value={regularEmployeeFilter}
                  onChange={(e) => setRegularEmployeeFilter(e.target.value)}
                  className="max-w-xs flex-1 min-w-[160px]"
                />
                <Input
                  placeholder="Filter by task name..."
                  value={regularTaskFilter}
                  onChange={(e) => setRegularTaskFilter(e.target.value)}
                  className="max-w-xs flex-1 min-w-[160px]"
                />
              </div>
              {sortedTodayGroupsFiltered.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-muted-foreground">No tasks due today for your team</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {sortedTodayGroupsFiltered.map(([employeeName, rows]) => (
                    <details key={employeeName} className="group rounded-lg border">
                      <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 text-left">
                          {employeeName} &mdash; {rows.length} task{rows.length !== 1 ? "s" : ""}
                        </span>
                        <ChevronDown
                          className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                          aria-hidden
                        />
                      </summary>
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Task Name</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Frequency</TableHead>
                              <TableHead>Number</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-12 text-right">
                                <span className="sr-only">Expand review</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row) => {
                              const rowKey = `${row.member.id}-${row.task.id}-${row.log?.id || 'no-log'}`;
                              const isPending = row.log?.verification_status === "pending";
                              const expanded = expandedRegularRowKeys.has(rowKey);
                              const employeeComment = (row.log?.comment && String(row.log.comment).trim()) || "";
                              const employeeReason = (row.log?.reason && String(row.log.reason).trim()) || "";
                              const hasEmployeeNote = Boolean(employeeComment || employeeReason);
                              const canRecallRow =
                                row.log &&
                                (row.log.verification_status === "approved" ||
                                  row.log.verification_status === "rejected");
                              const statusClass =
                                row.status === "Completed & verified"
                                  ? "bg-emerald-100 text-emerald-900"
                                  : row.status === "Rejected"
                                    ? "bg-red-100 text-red-800"
                                    : row.status === "Recalled"
                                      ? "bg-amber-100 text-amber-900"
                                      : row.status === "Pending Approval"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : row.status === "Not Submitted"
                                          ? "bg-red-100 text-red-800"
                                          : "";
                              return (
                                <Fragment key={rowKey}>
                                  <TableRow>
                                    <TableCell>{row.member.full_name}</TableCell>
                                    <TableCell className="font-medium">{row.task.title}</TableCell>
                                    <TableCell className="max-w-md">
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {row.task.description || "-"}
                                      </p>
                                    </TableCell>
                                    <TableCell>
                                      <span className="rounded bg-blue-100 px-2 py-1 text-xs capitalize text-blue-800">
                                        {row.task.type}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {row.task.source_manager_periodic_task_id ? "Periodic" : "Once"}
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
                                    <TableCell className="text-right align-middle">
                                      <div className="flex justify-end gap-1">
                                        {isPending ? (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            aria-expanded={expanded}
                                            aria-label={expanded ? "Collapse review" : "Expand review"}
                                            onClick={() => {
                                              setRegularRowMenuKey(null);
                                              toggleRegularTaskRow(rowKey);
                                            }}
                                          >
                                            {expanded ? (
                                              <ChevronUp className="h-4 w-4" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4" />
                                            )}
                                          </Button>
                                        ) : null}
                                        {canRecallRow ? (
                                          <div className="relative inline-block text-left">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8"
                                              aria-expanded={regularRowMenuKey === rowKey}
                                              aria-label="Task actions"
                                              onClick={() =>
                                                setRegularRowMenuKey((prev) => (prev === rowKey ? null : rowKey))
                                              }
                                            >
                                              <MoreVertical className="h-4 w-4" />
                                            </Button>
                                            {regularRowMenuKey === rowKey && (
                                              <div className="option-panel absolute right-0 z-10 mt-1 w-44 rounded-md border bg-background p-1 shadow-md">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="w-full justify-start font-medium"
                                                  onClick={() => {
                                                    setRegularRowMenuKey(null);
                                                    setRecallComment("");
                                                    setRecallDialog({ open: true, log: row.log });
                                                  }}
                                                >
                                                  Recall
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  {isPending && expanded && (
                                    <TableRow>
                                      <TableCell colSpan={8} className="bg-muted/40">
                                        <div className="space-y-3 py-2">
                                          {hasEmployeeNote ? (
                                            <div className="rounded-md border border-slate-200 bg-background px-3 py-2 text-sm space-y-1">
                                              {employeeComment ? (
                                                <p className="whitespace-pre-wrap text-foreground">
                                                  <span className="text-muted-foreground">Comment: </span>
                                                  {employeeComment}
                                                </p>
                                              ) : null}
                                              {employeeReason ? (
                                                <p className="whitespace-pre-wrap text-foreground">
                                                  <span className="text-muted-foreground">Incomplete / note: </span>
                                                  {employeeReason}
                                                </p>
                                              ) : null}
                                            </div>
                                          ) : null}
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm text-muted-foreground mr-2">Review submission</span>
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                setActionDialog({ open: true, type: "task", item: row.log, action: "approve" })
                                              }
                                            >
                                              Approve
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() =>
                                                setActionDialog({ open: true, type: "task", item: row.log, action: "reject" })
                                              }
                                            >
                                              Reject
                                            </Button>
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  ))}
                </div>
              )}

              <details className="group rounded-lg border">
                <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 text-left">Number of certificates</span>
                  <ChevronDown
                    className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
            <div className="border-t p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setCertGraphDropdownOpen((prev) => !prev)}
                  >
                    <span className="truncate">
                      {selectedCertEmployeeIds.length > 0
                        ? `${selectedCertEmployeeIds.length} employee${selectedCertEmployeeIds.length !== 1 ? "s" : ""} selected`
                        : "Select employees"}
                    </span>
                  </Button>
                  {certGraphDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-full min-w-[280px] rounded-md border bg-background shadow-md p-2 space-y-2">
                      <Input
                        placeholder="Search employee..."
                        value={certGraphEmployeeFilter}
                        onChange={(e) => setCertGraphEmployeeFilter(e.target.value)}
                      />
                      <div className="max-h-56 overflow-y-auto rounded border">
                        {filteredCertGraphMembers.length === 0 ? (
                          <div className="text-sm text-muted-foreground p-3">No matching employees.</div>
                        ) : (
                          filteredCertGraphMembers.map((member) => {
                            const selected = selectedCertEmployeeIds.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                type="button"
                                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
                                onClick={() => {
                                  setSelectedCertEmployeeIds((prev) => {
                                    if (prev.includes(member.id)) {
                                      return prev.filter((id) => id !== member.id);
                                    }
                                    if (prev.length >= CERT_GRAPH_MAX_EMPLOYEES) return prev;
                                    return [...prev, member.id];
                                  });
                                }}
                              >
                                <span className="truncate">{member.full_name}</span>
                                <span className={selected ? "text-primary" : "text-muted-foreground"}>
                                  {selected ? "✓" : ""}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={certGraphMode === "daily" ? "default" : "outline"}
                    onClick={() => setCertGraphMode("daily")}
                  >
                    Daily
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={certGraphMode === "monthly" ? "default" : "outline"}
                    onClick={() => setCertGraphMode("monthly")}
                  >
                    Monthly
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground flex items-center">
                  Select up to {CERT_GRAPH_MAX_EMPLOYEES} employees
                </div>
              </div>

              {selectedCertEmployeeIds.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  Select at least one employee to render the graph.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={certGraphData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="axisLabel" />
                      <YAxis />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const total = payload.reduce((sum, p: any) => sum + (Number(p.value) || 0), 0);
                          return (
                            <div className="rounded-md border bg-background p-3 shadow-sm text-sm">
                              <p className="font-medium mb-1">{label}</p>
                              {payload.map((p: any, idx: number) => (
                                <p key={`${p.dataKey}-${idx}`} style={{ color: p.color }}>
                                  {p.name}: {p.value}
                                </p>
                              ))}
                              <p className="mt-2 font-semibold">Total: {total}</p>
                            </div>
                          );
                        }}
                      />
                      {selectedCertEmployeeIds.map((id, index) => {
                        const member = teamMembers.find((m) => m.id === id);
                        return (
                          <Line
                            key={id}
                            type="monotone"
                            dataKey={id}
                            name={member?.full_name || "Employee"}
                            stroke={CERT_GRAPH_COLORS[index % CERT_GRAPH_COLORS.length]}
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </details>
            </div>
          )}

          {tasksSubView === "shared" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Filter by employee name..."
                  value={sharedEmployeeFilter}
                  onChange={(e) => setSharedEmployeeFilter(e.target.value)}
                  className="max-w-xs flex-1 min-w-[160px]"
                />
                <Input
                  placeholder="Filter by task name..."
                  value={sharedTaskFilter}
                  onChange={(e) => setSharedTaskFilter(e.target.value)}
                  className="max-w-xs flex-1 min-w-[160px]"
                />
              </div>
              <SharedNumericTasksAccordion
                tasks={managedTeamTasks}
                taskLogs={taskLogs as TaskLog[]}
                employees={teamMembers}
                today={today}
                employeeNameFilter={sharedEmployeeFilter}
                taskNameFilter={sharedTaskFilter}
              />
            </div>
          )}

          {tasksSubView === "history" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Employee name..."
                  value={taskHistoryEmployeeFilter}
                  onChange={(e) => setTaskHistoryEmployeeFilter(e.target.value)}
                  className="min-w-[160px] flex-1 max-w-xs"
                />
                <Input
                  placeholder="Task name..."
                  value={taskHistoryTaskFilter}
                  onChange={(e) => setTaskHistoryTaskFilter(e.target.value)}
                  className="min-w-[160px] flex-1 max-w-xs"
                />
                <Input
                  type="date"
                  placeholder="From"
                  value={taskHistoryDateFrom}
                  onChange={(e) => setTaskHistoryDateFrom(e.target.value)}
                  className="w-44"
                />
                <Input
                  type="date"
                  placeholder="To"
                  value={taskHistoryDateTo}
                  onChange={(e) => setTaskHistoryDateTo(e.target.value)}
                  className="w-44"
                />
              </div>
              {(() => {
                const groups = groupByDay(filteredTaskHistoryLogs, getTaskDay);
                if (groups.length === 0) {
                  return (
                    <Card>
                      <CardContent className="p-6 text-center text-muted-foreground">No task history for these filters</CardContent>
                    </Card>
                  );
                }
                return (
                  <div className="space-y-2">
                    {groups.map(([date, logs]) => (
                      <details key={date} className="group rounded-lg border">
                        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 text-left">
                            {format(new Date(date), "dd MMM yyyy")} &mdash; {logs.length} submission
                            {logs.length !== 1 ? "s" : ""}
                          </span>
                          <ChevronDown
                            className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                            aria-hidden
                          />
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
                                <TableHead className="w-12 text-right">
                                  <span className="sr-only">Actions</span>
                                </TableHead>
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
                                  <TableCell>
                                    {log.submitted_at ? format(new Date(log.submitted_at), "HH:mm dd/MM/yyyy") : "-"}
                                  </TableCell>
                                  <TableCell>
                                    {log.verified_at ? format(new Date(log.verified_at), "HH:mm dd/MM/yyyy") : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {log.verification_status === "approved" || log.verification_status === "rejected" ? (
                                      <div className="relative inline-block text-left">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          aria-expanded={taskHistoryRowMenuKey === log.id}
                                          aria-label="Task actions"
                                          onClick={() =>
                                            setTaskHistoryRowMenuKey((prev) => (prev === log.id ? null : log.id))
                                          }
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                        {taskHistoryRowMenuKey === log.id && (
                                          <div className="option-panel absolute right-0 z-10 mt-1 w-44 rounded-md border bg-background p-1 shadow-md">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="w-full justify-start font-medium"
                                              onClick={() => {
                                                setTaskHistoryRowMenuKey(null);
                                                setRecallComment("");
                                                setRecallDialog({ open: true, log: log });
                                              }}
                                            >
                                              Recall
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ) : null}
                                  </TableCell>
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance-report" className="space-y-4">
          <Tabs defaultValue="current" className="space-y-4">
            <TabsList className="flex h-auto w-full justify-start gap-6 rounded-none border-b border-slate-200 bg-transparent p-0 mb-4">
              <TabsTrigger 
                value="current"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Current ({currentAttendanceReportItems.length})
              </TabsTrigger>
              <TabsTrigger 
                value="history"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                History ({historyAttendanceReportItems.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              <Input
                placeholder="Search by employee name..."
                value={currentSearchTerm}
                onChange={(e) => setCurrentSearchTerm(e.target.value)}
                className="max-w-md"
              />
              {currentAttendanceReportItems.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAttendanceReportItems.map((att) => (
                        <TableRow key={att.id}>
                          <TableCell>{att.users?.full_name}</TableCell>
                          <TableCell>{format(new Date(att.date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{att.clock_in_time ? format(new Date(att.clock_in_time), "HH:mm dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{att.clock_out_time ? format(new Date(att.clock_out_time), "HH:mm dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{att.late_reason || "-"}</TableCell>
                          <TableCell className="capitalize">{att.approval_status}</TableCell>
                          <TableCell>
                            {att.is_late_request && att.approval_status === "pending" ? (
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
                <Card><CardContent className="p-6 text-center text-muted-foreground">No attendance report entries for today</CardContent></Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <Input
                  placeholder="Search by employee name..."
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <Input
                  type="date"
                  placeholder="From date"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-44"
                />
                <Input
                  type="date"
                  placeholder="To date"
                  value={historyToDateFilter}
                  onChange={(e) => setHistoryToDateFilter(e.target.value)}
                  className="w-44"
                />
              </div>
              {(() => {
                const filteredItems = historyAttendanceReportItems.filter((att) => {
                  const nameMatch = matchesName(att.users?.full_name, historySearchTerm);
                  const attDate = getAttendanceDay(att);
                  let dateMatch = true;
                  if (historyDateFilter && historyToDateFilter) {
                    dateMatch = attDate >= historyDateFilter && attDate <= historyToDateFilter;
                  } else if (historyDateFilter) {
                    dateMatch = attDate >= historyDateFilter;
                  } else if (historyToDateFilter) {
                    dateMatch = attDate <= historyToDateFilter;
                  }
                  return nameMatch && dateMatch;
                });

                const groups = groupByEmployee(filteredItems);
                
                if (groups.length === 0) {
                  return <Card><CardContent className="p-6 text-center text-muted-foreground">No attendance report history</CardContent></Card>;
                }

                return (
                  <div className="space-y-2">
                    {groups.map(([employeeName, items]) => {
                      const totalHours = calculateTotalHours(items);
                      const daysPresent = items.filter((att: any) => att.clock_in_time).length;
                      const userId = items[0]?.user_id;
                      
                      return (
                        <details key={employeeName} className="group rounded-lg border">
                          <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 text-left">
                              {employeeName} &mdash; {items.length} record{items.length !== 1 ? "s" : ""}
                            </span>
                            <ChevronDown
                              className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                              aria-hidden
                            />
                          </summary>
                          <div className="border-t p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <Card>
                                <CardContent className="p-4">
                                  <p className="text-sm text-muted-foreground">Total Hours</p>
                                  <p className="text-2xl font-bold">{totalHours}h</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4">
                                  <p className="text-sm text-muted-foreground">Days Present</p>
                                  <p className="text-2xl font-bold">{daysPresent}</p>
                                </CardContent>
                              </Card>
                            </div>
                            <div className="border rounded-lg">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Clock In</TableHead>
                                    <TableHead>Clock Out</TableHead>
                                    <TableHead>Hours</TableHead>
                                    <TableHead>Tasks Complete</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((att: any) => (
                                    <TableRow key={att.id}>
                                      <TableCell>{format(new Date(att.date), "dd/MM/yyyy")}</TableCell>
                                      <TableCell>{att.clock_in_time ? format(new Date(att.clock_in_time), "HH:mm") : "-"}</TableCell>
                                      <TableCell>{att.clock_out_time ? format(new Date(att.clock_out_time), "HH:mm") : "-"}</TableCell>
                                      <TableCell>{calculateHours(att.clock_in_time, att.clock_out_time)}</TableCell>
                                      <TableCell>{getTasksCompleteForDate(userId, getAttendanceDay(att))}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="mistakes" className="space-y-4">
          <Tabs defaultValue="mistakes-tracker" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Input
                placeholder="Search mistakes..."
                value={mistakeSearchTerm}
                onChange={(e) => setMistakeSearchTerm(e.target.value)}
                className="min-w-[160px] flex-1 max-w-md"
              />
              <div className="flex items-center gap-3 ml-auto">
                <TabsList className="flex h-auto justify-start gap-4 rounded-none border-b border-slate-200 bg-transparent p-0">
                  <TabsTrigger 
                    value="closure-requests"
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Closure Requests ({filteredClosureRequests.length})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="mistakes-tracker"
                    className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Mistakes
                  </TabsTrigger>
                </TabsList>
                <Button type="button" className="shrink-0" onClick={openCreateMistakeDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Mistake
                </Button>
              </div>
            </div>

            <TabsContent value="closure-requests" className="space-y-4">
              {filteredClosureRequests.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Added By</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClosureRequests.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.date ? format(new Date(m.date), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{m.users?.full_name || "-"}</TableCell>
                          <TableCell className="font-medium max-w-xs truncate">{m.title || "-"}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                m.severity === "high"
                                  ? "bg-red-100 text-red-800"
                                  : m.severity === "medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                              }
                            >
                              {m.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>{m.added_by_user?.full_name || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={actionLoading}
                                onClick={() => handleClosureAccept(m.id)}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={actionLoading}
                                onClick={() => handleClosureReject(m.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No closure requests</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {mistakeSearchTerm ? "Try a different search term" : "Pending employee requests will appear here"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="mistakes-tracker" className="space-y-4">
              {filteredMistakes.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Added By</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMistakes.map((m) => {
                        const isExpanded = expandedMistakeRows.has(m.id);
                        const trackerStatus = m.status || "open";
                        return (
                          <Fragment key={m.id}>
                            <TableRow>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleMistakeRow(m.id)}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </TableCell>
                              <TableCell>{m.date ? format(new Date(m.date), "dd/MM/yyyy") : "-"}</TableCell>
                              <TableCell>{m.users?.full_name || "-"}</TableCell>
                              <TableCell className="font-medium">{m.title || "-"}</TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    m.severity === "high"
                                      ? "bg-red-100 text-red-800"
                                      : m.severity === "medium"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-green-100 text-green-800"
                                  }
                                >
                                  {m.severity}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge
                                    className={
                                      trackerStatus === "rectified"
                                        ? "bg-emerald-100 text-emerald-900 w-fit capitalize"
                                        : "bg-slate-100 text-slate-800 w-fit capitalize"
                                    }
                                  >
                                    {trackerStatus === "rectified" ? "Rectified" : "Open"}
                                  </Badge>
                                  {m.closure_request_pending && trackerStatus === "open" ? (
                                    <span className="text-xs text-amber-700">Closure pending</span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell>{m.added_by_user?.full_name || "-"}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditMistakeDialog(m)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteMistake(m.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={8} className="bg-muted/30">
                                  <div className="py-2">
                                    <p className="text-sm font-medium mb-1">Description</p>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                      {m.description || "-"}
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No mistakes recorded</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {mistakeSearchTerm ? "Try a different search term" : "Record mistakes to track quality issues"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="leaves" className="space-y-4">
          <Tabs defaultValue="current" className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <Input
                placeholder="Search by employee name..."
                value={leavesSearchTerm}
                onChange={(e) => setLeavesSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Input
                type="date"
                value={leavesDateFilter}
                onChange={(e) => setLeavesDateFilter(e.target.value)}
                className="w-44"
              />
              <TabsList className="flex h-auto justify-start gap-6 rounded-none border-b border-slate-200 bg-transparent p-0">
                <TabsTrigger 
                  value="current"
                  className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Current ({currentLeaveItems.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  History ({historyLeaveItems.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="current" className="space-y-4">
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
              {(() => {
                const groups = groupByDay(historyLeaveItems, getLeaveDay);
                if (groups.length === 0) {
                  return <Card><CardContent className="p-6 text-center text-muted-foreground">No leave history</CardContent></Card>;
                }
                return (
                  <div className="space-y-2">
                    {groups.map(([date, items]) => (
                      <details key={date} className="group rounded-lg border">
                        <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 text-left">
                            {format(new Date(date), "dd MMM yyyy")} &mdash; {items.length} request
                            {items.length !== 1 ? "s" : ""}
                          </span>
                          <ChevronDown
                            className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                            aria-hidden
                          />
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

        <TabsContent value="calendar" className="space-y-4">
          <ManagerCalendarTab teamMembers={teamMembers} />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Input
            placeholder="Search by name or email..."
            value={teamSearchTerm}
            onChange={(e) => setTeamSearchTerm(e.target.value)}
            className="max-w-md"
          />
          {teamMembers.filter((member) => {
            const q = teamSearchTerm.toLowerCase();
            return (
              member.full_name.toLowerCase().includes(q) ||
              (member.email || "").toLowerCase().includes(q)
            );
          }).length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Member since</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers
                    .filter((member) => {
                      const q = teamSearchTerm.toLowerCase();
                      return (
                        member.full_name.toLowerCase().includes(q) ||
                        (member.email || "").toLowerCase().includes(q)
                      );
                    })
                    .map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{member.email}</TableCell>
                        <TableCell className="capitalize">{member.role}</TableCell>
                        <TableCell className="text-sm">{member.timezone || "—"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {member.created_at
                            ? format(new Date(member.created_at), "dd MMM yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {member.is_resigned ? (
                            <Badge variant="secondary">Resigned</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No team members assigned</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <ManagerDocumentsTab currentUser={user} teamMembers={teamMembers} onTeamRefresh={fetchData} />
        </TabsContent>

        <TabsContent value="salary" className="space-y-4">
          <ManagerSalaryTab currentUser={user} teamMembers={teamMembers} />
        </TabsContent>

        <TabsContent value="ratings" className="space-y-4">
          {user && <ManagerEmployeeRatingsTab currentUser={user} teamMembers={teamMembers} />}
        </TabsContent>

        <TabsContent value="task-assignment" className="space-y-4">
          {user && (
            <TaskAssignmentPanel
              mode="manager"
              organizationId={user.organization_id}
              currentUserId={user.id}
              assignableUsers={teamMembers}
              tasks={managedTeamTasks}
              monthlyNumericLinkOptions={monthlyNumericLinkOptions}
              monthlyPeriodicLinkOptions={monthlyPeriodicNumericLinkOptions}
              onTasksChanged={fetchData}
              managerCurrentHistorySplit
              managerPeriodicTasks={periodicTasks}
              orgSlug={orgSlug}
            />
          )}
        </TabsContent>
          </section>
        </div>
      </Tabs>

      <Dialog open={mistakeDialog.open} onOpenChange={(open) => {
        if (!open) {
          setMistakeDialog({ open: false, mode: 'create', mistake: null });
          setMistakeForm({ title: '', description: '', severity: 'medium', userId: '' });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mistakeDialog.mode === 'create' ? 'Record Mistake' : 'Edit Mistake'}
            </DialogTitle>
            <DialogDescription>
              {mistakeDialog.mode === 'create'
                ? 'Record a mistake for an employee'
                : 'Update mistake information'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mistakeTitle">Title (required)</Label>
              <Input
                id="mistakeTitle"
                placeholder="Brief title for the mistake"
                value={mistakeForm.title}
                onChange={(e) => setMistakeForm({ ...mistakeForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mistakeEmployee">Employee (required)</Label>
              <Select
                value={mistakeForm.userId}
                onValueChange={(value) => setMistakeForm({ ...mistakeForm, userId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mistakeDescription">Description (required)</Label>
              <Textarea
                id="mistakeDescription"
                placeholder="Describe the mistake..."
                value={mistakeForm.description}
                onChange={(e) => setMistakeForm({ ...mistakeForm, description: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mistakeSeverity">Severity</Label>
              <Select
                value={mistakeForm.severity}
                onValueChange={(value: 'low' | 'medium' | 'high') => setMistakeForm({ ...mistakeForm, severity: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMistakeDialog({ open: false, mode: 'create', mistake: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={mistakeDialog.mode === 'create' ? handleCreateMistake : handleUpdateMistake}
              disabled={actionLoading || !mistakeForm.title || !mistakeForm.userId}
            >
              {actionLoading ? "Saving..." : mistakeDialog.mode === 'create' ? "Record Mistake" : "Update Mistake"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {actionDialog.type === "task"
                ? actionDialog.action === "reject"
                  ? "Review the employee’s note below, then add your rejection reason."
                  : "Review the employee’s submission below. You can add an optional note for them."
                : actionDialog.action === "reject"
                  ? "Please provide a reason for rejection"
                  : "Add an optional comment"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionDialog.type === "task" && actionDialog.item
              ? (() => {
                  const item = actionDialog.item;
                  const empC = (item.comment && String(item.comment).trim()) || "";
                  const empR = (item.reason && String(item.reason).trim()) || "";
                  if (!empC && !empR) return null;
                  return (
                    <div className="rounded-md border border-slate-200 bg-muted/40 p-3 text-sm space-y-1">
                      {empC ? (
                        <p className="whitespace-pre-wrap text-foreground">
                          <span className="text-muted-foreground">Comment: </span>
                          {empC}
                        </p>
                      ) : null}
                      {empR ? (
                        <p className="whitespace-pre-wrap text-foreground">
                          <span className="text-muted-foreground">Incomplete / note: </span>
                          {empR}
                        </p>
                      ) : null}
                    </div>
                  );
                })()
              : null}
            <div className="space-y-2">
              <Label htmlFor="comment">
                {actionDialog.type === "task" ? "Your review comment " : "Comment "}
                {actionDialog.action === "reject" ? "(required)" : "(optional)"}
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

      <Dialog
        open={recallDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRecallDialog({ open: false, log: null });
            setRecallComment("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recall submission</DialogTitle>
            <DialogDescription>
              The task returns to the employee as <strong>Recalled</strong> so they can fix and resubmit. Optional note
              is appended to the review trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="recallComment">Note (optional)</Label>
            <Textarea
              id="recallComment"
              placeholder="Why you are recalling this decision…"
              value={recallComment}
              onChange={(e) => setRecallComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRecallDialog({ open: false, log: null });
                setRecallComment("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRecallConfirm} disabled={actionLoading}>
              {actionLoading ? "Saving…" : "Confirm recall"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
