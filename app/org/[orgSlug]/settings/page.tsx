"use client";

import React, { useEffect, useState } from "react";
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
import { Plus, Pencil, Trash2, Users as UsersIcon, ListTodo, ChevronDown, ChevronUp, Eye, AlertTriangle, Star, Trophy, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { format } from "date-fns";
import type { User, Task, Announcement } from "@/lib/types/database";

/** Radix Select.Item must not use value=""; map sentinels to "" in form state */
const NO_MANAGER_VALUE = "__no_manager__";
const NO_LINKED_MONTHLY_VALUE = "__no_linked_monthly__";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allMistakes, setAllMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [taskSearchTerm, setTaskSearchTerm] = useState("");
  const [mistakeSearchTerm, setMistakeSearchTerm] = useState("");
  const [expandedTaskRows, setExpandedTaskRows] = useState<Set<string>>(new Set());
  const [expandedMistakeRows, setExpandedMistakeRows] = useState<Set<string>>(new Set());
  
  const [userDialog, setUserDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    user: Partial<User> | null;
  }>({
    open: false,
    mode: 'create',
    user: null,
  });

  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    task: Partial<Task> | null;
  }>({
    open: false,
    mode: 'create',
    task: null,
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

  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'employee' as 'admin' | 'manager' | 'employee',
    managerId: '',
    timezone: 'UTC',
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    type: 'daily' as 'daily' | 'weekly' | 'monthly',
    dayOfWeek: '',
    dueDate: '',
    assignmentType: 'common' as 'common' | 'specific',
    assignedTo: '',
    isActive: true,
    isNumericTask: false,
    numericUnit: '',
    linkedMonthlyTaskId: '',
  });

  const [mistakeForm, setMistakeForm] = useState({
    title: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    userId: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const [ratingsMonth, setRatingsMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [ratingsEntries, setRatingsEntries] = useState<Array<{ userId: string; score: number | ''; notes: string }>>([]);
  const [publishingRatings, setPublishingRatings] = useState(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (user && allUsers.length > 0) {
      fetchRatings(ratingsMonth, user.organization_id, allUsers);
    }
  }, [user, allUsers, ratingsMonth]);

  const fetchData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userData?.role !== 'admin') {
      toast({
        title: "Access denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      return;
    }

    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false });

    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false });

    const { data: mistakes } = await supabase
      .from('mistakes')
      .select('*, users!mistakes_user_id_fkey(full_name), added_by_user:users!mistakes_added_by_fkey(full_name)')
      .eq('organization_id', userData.organization_id)
      .order('date', { ascending: false });

    setUser(userData);
    setAllUsers(users || []);
    setAllTasks(tasks || []);
    setAllMistakes(mistakes || []);
    setLoading(false);

    if (userData?.organization_id) {
      fetchAnnouncements(userData.organization_id);
    }
  };

  const handleCreateUser = async () => {
    if (!userForm.email || !userForm.password || !userForm.fullName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password,
          fullName: userForm.fullName,
          role: userForm.role,
          managerId: userForm.managerId || null,
          timezone: userForm.timezone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'User creation failed');
      }

      toast({
        title: "Success",
        description: "User created successfully",
      });

      setUserDialog({ open: false, mode: 'create', user: null });
      setUserForm({
        email: '',
        password: '',
        fullName: '',
        role: 'employee',
        managerId: '',
        timezone: 'UTC',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!userDialog.user?.id || !userForm.fullName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/update-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userDialog.user.id,
          email: userForm.email || undefined,
          password: userForm.password || undefined,
          fullName: userForm.fullName,
          role: userForm.role,
          managerId: userForm.managerId || null,
          timezone: userForm.timezone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'User update failed');
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setUserDialog({ open: false, mode: 'create', user: null });
      setUserForm({
        email: '',
        password: '',
        fullName: '',
        role: 'employee',
        managerId: '',
        timezone: 'UTC',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      const response = await fetch('/api/auth/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'User deletion failed');
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditUserDialog = (userToEdit: User) => {
    setUserForm({
      email: userToEdit.email ?? '',
      password: '',
      fullName: userToEdit.full_name ?? '',
      role: userToEdit.role,
      managerId: userToEdit.manager_id ?? '',
      timezone: userToEdit.timezone ?? 'UTC',
    });
    setUserDialog({ open: true, mode: 'edit', user: userToEdit });
  };

  const openCreateUserDialog = () => {
    setUserForm({
      email: '',
      password: '',
      fullName: '',
      role: 'employee',
      managerId: '',
      timezone: 'UTC',
    });
    setUserDialog({ open: true, mode: 'create', user: null });
  };

  const handleCreateTask = async () => {
    if (!user || !taskForm.title) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const taskData: any = {
        organization_id: user.organization_id,
        title: taskForm.title,
        description: taskForm.description || null,
        type: taskForm.type,
        assigned_by: user.id,
        is_common_task: taskForm.assignmentType === 'common',
        assigned_to: taskForm.assignmentType === 'specific' ? taskForm.assignedTo : null,
        is_active: taskForm.isActive,
        is_numeric_task: taskForm.isNumericTask,
        numeric_unit: taskForm.isNumericTask ? taskForm.numericUnit : null,
        linked_monthly_task_id: taskForm.linkedMonthlyTaskId || null,
      };

      if (taskForm.type === 'weekly' && taskForm.dayOfWeek) {
        taskData.day_of_week = parseInt(taskForm.dayOfWeek);
      }

      if (taskForm.type === 'monthly' && taskForm.dueDate) {
        taskData.due_date = taskForm.dueDate;
      }

      const { error } = await supabase
        .from('tasks')
        .insert(taskData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task created successfully",
      });

      setTaskDialog({ open: false, mode: 'create', task: null });
      setTaskForm({
        title: '',
        description: '',
        type: 'daily',
        dayOfWeek: '',
        dueDate: '',
        assignmentType: 'common',
        assignedTo: '',
        isActive: true,
        isNumericTask: false,
        numericUnit: '',
        linkedMonthlyTaskId: '',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!taskDialog.task?.id || !taskForm.title) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const taskData: any = {
        title: taskForm.title,
        description: taskForm.description || null,
        type: taskForm.type,
        is_common_task: taskForm.assignmentType === 'common',
        assigned_to: taskForm.assignmentType === 'specific' ? taskForm.assignedTo : null,
        is_active: taskForm.isActive,
        is_numeric_task: taskForm.isNumericTask,
        numeric_unit: taskForm.isNumericTask ? taskForm.numericUnit : null,
        linked_monthly_task_id: taskForm.linkedMonthlyTaskId || null,
      };

      if (taskForm.type === 'weekly' && taskForm.dayOfWeek) {
        taskData.day_of_week = parseInt(taskForm.dayOfWeek);
      } else {
        taskData.day_of_week = null;
      }

      if (taskForm.type === 'monthly' && taskForm.dueDate) {
        taskData.due_date = taskForm.dueDate;
      } else {
        taskData.due_date = null;
      }

      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskDialog.task.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task updated successfully",
      });

      setTaskDialog({ open: false, mode: 'create', task: null });
      setTaskForm({
        title: '',
        description: '',
        type: 'daily',
        dayOfWeek: '',
        dueDate: '',
        assignmentType: 'common',
        assignedTo: '',
        isActive: true,
        isNumericTask: false,
        numericUnit: '',
        linkedMonthlyTaskId: '',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateMistake = async () => {
    if (!mistakeForm.title || !mistakeForm.userId) {
      toast({
        title: "Error",
        description: "Please fill in title and select an employee",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('mistakes')
        .insert({
          organization_id: user?.organization_id,
          user_id: mistakeForm.userId,
          added_by: user?.id,
          description: mistakeForm.description,
          severity: mistakeForm.severity,
          date: new Date().toISOString().split('T')[0],
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mistake recorded successfully",
      });

      setMistakeDialog({ open: false, mode: 'create', mistake: null });
      setMistakeForm({ title: '', description: '', severity: 'medium', userId: '' });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('mistakes')
        .update({
          user_id: mistakeForm.userId,
          description: mistakeForm.description,
          severity: mistakeForm.severity,
        })
        .eq('id', mistakeDialog.mistake.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mistake updated successfully",
      });

      setMistakeDialog({ open: false, mode: 'edit', mistake: null });
      setMistakeForm({ title: '', description: '', severity: 'medium', userId: '' });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMistake = async (mistakeId: string) => {
    if (!confirm('Are you sure you want to delete this mistake record?')) return;

    try {
      const { error } = await supabase
        .from('mistakes')
        .delete()
        .eq('id', mistakeId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mistake deleted successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchRatings = async (month: string, orgId: string, employees: User[]) => {
    const firstDay = `${month}-01`;
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('organization_id', orgId)
      .eq('month', firstDay);

    const ratingsByUser: Record<string, any> = {};
    for (const row of (data || [])) {
      ratingsByUser[row.user_id] = row;
    }

    setRatingsEntries(
      employees.filter(u => u.role !== 'admin').map(u => ({
        userId: u.id,
        score: ratingsByUser[u.id]?.score ?? '',
        notes: ratingsByUser[u.id]?.notes ?? '',
      }))
    );
  };

  const handlePublishRatings = async () => {
    const validEntries = ratingsEntries.filter(e => e.score !== '' && Number(e.score) > 0);
    if (validEntries.length === 0) {
      toast({ title: "No ratings entered", description: "Enter at least one score before publishing.", variant: "destructive" });
      return;
    }

    setPublishingRatings(true);
    try {
      const firstDay = `${ratingsMonth}-01`;
      const sorted = [...validEntries].sort((a, b) => (Number(b.score)) - (Number(a.score)));
      const rows = sorted.map((e, i) => ({
        user_id: e.userId,
        organization_id: user!.organization_id,
        month: firstDay,
        score: Number(e.score),
        rank: i + 1,
        notes: e.notes || null,
        decided_by: user!.id,
      }));

      const { error } = await supabase
        .from('leaderboard')
        .upsert(rows, { onConflict: 'user_id,month' });

      if (error) throw error;

      toast({ title: "Ratings published!", description: "Leaderboard has been updated." });
      fetchRatings(ratingsMonth, user!.organization_id, allUsers);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setPublishingRatings(false);
    }
  };

  const fetchAnnouncements = async (orgId: string) => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
  };

  const handlePostAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementContent.trim() || announcementContent === '<p></p>') {
      toast({ title: "Error", description: "Please enter a title and content.", variant: "destructive" });
      return;
    }
    setPostingAnnouncement(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        organization_id: user!.organization_id,
        title: announcementTitle.trim(),
        content: announcementContent,
        created_by: user!.id,
      });
      if (error) throw error;
      toast({ title: "Announcement posted!" });
      setAnnouncementTitle('');
      setAnnouncementContent('');
      fetchAnnouncements(user!.organization_id);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Announcement deleted" });
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openCreateMistakeDialog = () => {
    setMistakeForm({ title: '', description: '', severity: 'medium', userId: '' });
    setMistakeDialog({ open: true, mode: 'create', mistake: null });
  };

  const openEditMistakeDialog = (mistake: any) => {
    setMistakeForm({
      title: mistake.description || '',
      description: mistake.description || '',
      severity: mistake.severity || 'medium',
      userId: mistake.user_id || '',
    });
    setMistakeDialog({ open: true, mode: 'edit', mistake });
  };

  const openEditTaskDialog = (taskToEdit: Task) => {
    const assignedUser = allUsers.find(u => u.id === taskToEdit.assigned_to);
    setTaskForm({
      title: taskToEdit.title ?? '',
      description: taskToEdit.description ?? '',
      type: taskToEdit.type,
      dayOfWeek: taskToEdit.day_of_week != null ? String(taskToEdit.day_of_week) : '',
      dueDate: taskToEdit.due_date ?? '',
      assignmentType: taskToEdit.is_common_task ? 'common' : 'specific',
      assignedTo: taskToEdit.assigned_to ?? '',
      isActive: Boolean(taskToEdit.is_active),
      isNumericTask: Boolean(taskToEdit.is_numeric_task),
      numericUnit: taskToEdit.numeric_unit ?? '',
      linkedMonthlyTaskId: taskToEdit.linked_monthly_task_id ?? '',
    });
    setTaskDialog({ open: true, mode: 'edit', task: taskToEdit });
  };

  const openCreateTaskDialog = () => {
    setTaskForm({
      title: '',
      description: '',
      type: 'daily',
      dayOfWeek: '',
      dueDate: '',
      assignmentType: 'common',
      assignedTo: '',
      isActive: true,
      isNumericTask: false,
      numericUnit: '',
      linkedMonthlyTaskId: '',
    });
    setTaskDialog({ open: true, mode: 'create', task: null });
  };

  const filteredUsers = allUsers.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTasks = allTasks.filter(t => 
    t.title.toLowerCase().includes(taskSearchTerm.toLowerCase())
  );

  const filteredMistakes = allMistakes.filter(m => 
    m.description?.toLowerCase().includes(mistakeSearchTerm.toLowerCase()) ||
    m.users?.full_name?.toLowerCase().includes(mistakeSearchTerm.toLowerCase())
  );

  const toggleTaskRow = (taskId: string) => {
    const newExpanded = new Set(expandedTaskRows);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTaskRows(newExpanded);
  };

  const toggleMistakeRow = (mistakeId: string) => {
    const newExpanded = new Set(expandedMistakeRows);
    if (newExpanded.has(mistakeId)) {
      newExpanded.delete(mistakeId);
    } else {
      newExpanded.add(mistakeId);
    }
    setExpandedMistakeRows(newExpanded);
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
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage users and task assignments
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">
            <UsersIcon className="h-4 w-4 mr-2" />
            Users ({allUsers.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="h-4 w-4 mr-2" />
            Task Assignment ({allTasks.length})
          </TabsTrigger>
          <TabsTrigger value="mistakes">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Track Mistakes ({allMistakes.length})
          </TabsTrigger>
          <TabsTrigger value="ratings">
            <Star className="h-4 w-4 mr-2" />
            Employee Ratings
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Megaphone className="h-4 w-4 mr-2" />
            Announcements ({announcements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-1/3"
            />
            <Button onClick={openCreateUserDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          {filteredUsers.length > 0 ? (
            <div className="space-y-4">
              {filteredUsers.map((u) => (
                <Card key={u.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{u.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                            {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </span>
                          <span className="text-muted-foreground">
                            Timezone: {u.timezone}
                          </span>
                          {u.manager_id && (
                            <span className="text-muted-foreground">
                              Manager: {allUsers.find(m => m.id === u.manager_id)?.full_name || 'Unknown'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditUserDialog(u)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <UsersIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No users found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm ? 'Try a different search term' : 'Add users to your organization'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search tasks..."
              value={taskSearchTerm}
              onChange={(e) => setTaskSearchTerm(e.target.value)}
              className="w-1/3"
            />
            <Button onClick={openCreateTaskDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>

          {(() => {
            if (filteredTasks.length === 0) {
              return (
                <Card>
                  <CardContent className="p-12 text-center">
                    <ListTodo className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {taskSearchTerm ? 'Try a different search term' : 'Create tasks to assign to your team'}
                    </p>
                  </CardContent>
                </Card>
              );
            }

            // Group by employee bucket
            const groups: Record<string, Task[]> = {};
            for (const t of filteredTasks) {
              const key = t.is_common_task
                ? 'All Employees'
                : allUsers.find(u => u.id === t.assigned_to)?.full_name || 'Unassigned';
              if (!groups[key]) groups[key] = [];
              groups[key].push(t);
            }
            const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
              if (a === 'All Employees') return -1;
              if (b === 'All Employees') return 1;
              return a.localeCompare(b);
            });

            return (
              <div className="space-y-2">
                {sortedGroups.map(([employeeName, tasks]) => (
                  <details key={employeeName} className="rounded-lg border">
                    <summary className="cursor-pointer list-none px-4 py-3 font-medium hover:bg-muted/50">
                      {employeeName} &mdash; {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>Task Name</TableHead>
                            <TableHead>Task Type</TableHead>
                            <TableHead>Task Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tasks.map((t) => {
                            const isExpanded = expandedTaskRows.has(t.id);
                            return (
                              <React.Fragment key={t.id}>
                                <TableRow className={isExpanded ? 'bg-muted/50' : ''}>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleTaskRow(t.id)}
                                      className="h-8 w-8 p-0"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="font-medium">{t.title}</TableCell>
                                  <TableCell>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                      {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="max-w-md">
                                    <p className="text-sm text-muted-foreground truncate">
                                      {t.description || '-'}
                                    </p>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={4} className="bg-muted/30">
                                      <div className="py-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-sm font-medium mb-1">Full Description:</p>
                                            <p className="text-sm text-muted-foreground">{t.description || 'No description'}</p>
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium mb-1">Details:</p>
                                            <div className="space-y-1 text-sm text-muted-foreground">
                                              <p>Status: {t.is_active ? 'Active' : 'Inactive'}</p>
                                              {t.is_numeric_task && <p>Numeric Task: {t.numeric_unit || 'units'}</p>}
                                              {t.type === 'weekly' && t.day_of_week !== null && (
                                                <p>Day: {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.day_of_week!]}</p>
                                              )}
                                              {t.type === 'monthly' && t.due_date && <p>Due: {t.due_date}</p>}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openEditTaskDialog(t)}
                                          >
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Edit
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDeleteTask(t.id)}
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </Button>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                ))}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="mistakes" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search mistakes..."
              value={mistakeSearchTerm}
              onChange={(e) => setMistakeSearchTerm(e.target.value)}
              className="w-1/3"
            />
            <Button onClick={openCreateMistakeDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Record Mistake
            </Button>
          </div>

          {filteredMistakes.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMistakes.map((m) => {
                    const isExpanded = expandedMistakeRows.has(m.id);
                    
                    return (
                      <>
                        <TableRow key={m.id} className={isExpanded ? 'bg-muted/50' : ''}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMistakeRow(m.id)}
                              className="h-8 w-8 p-0"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{m.users?.full_name || 'Unknown'}</TableCell>
                          <TableCell className="max-w-xs truncate">{m.description?.substring(0, 50) || '-'}</TableCell>
                          <TableCell className="max-w-md">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {m.description || '-'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              m.severity === 'high' ? 'bg-red-100 text-red-800' :
                              m.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {m.severity?.charAt(0).toUpperCase() + m.severity?.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(m.date).toLocaleDateString('en-GB')}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30">
                              <div className="py-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-medium mb-1">Full Description:</p>
                                    <p className="text-sm text-muted-foreground">{m.description || 'No description'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium mb-1">Details:</p>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                      <p>Employee: {m.users?.full_name}</p>
                                      <p>Recorded by: {m.added_by_user?.full_name || 'Unknown'}</p>
                                      <p>Date: {new Date(m.date).toLocaleDateString('en-GB')}</p>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditMistakeDialog(m)}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteMistake(m.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No mistakes recorded</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {mistakeSearchTerm ? 'Try a different search term' : 'Record mistakes to track quality issues'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ratings" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Employee Ratings
                  </CardTitle>
                  <CardDescription>
                    Assign scores (1–10) and notes for employees. Publishing will update the leaderboard and recalculate ranks.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="ratingsMonth" className="whitespace-nowrap">Month</Label>
                  <Input
                    id="ratingsMonth"
                    type="month"
                    className="w-44"
                    value={ratingsMonth}
                    onChange={(e) => setRatingsMonth(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allUsers.filter(u => u.role !== 'admin').length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No employees found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-36">Score (1–10)</TableHead>
                      <TableHead>Custom Message / Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ratingsEntries.map((entry) => {
                      const emp = allUsers.find(u => u.id === entry.userId);
                      if (!emp) return null;
                      return (
                        <TableRow key={entry.userId}>
                          <TableCell className="font-medium">{emp.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{emp.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              step={1}
                              placeholder="–"
                              className="w-20"
                              value={entry.score}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Math.min(10, Math.max(1, parseInt(e.target.value, 10)));
                                setRatingsEntries(prev => prev.map(r => r.userId === entry.userId ? { ...r, score: val as number | '' } : r));
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              placeholder="Optional message shown on leaderboard..."
                              value={entry.notes}
                              onChange={(e) => setRatingsEntries(prev => prev.map(r => r.userId === entry.userId ? { ...r, notes: e.target.value } : r))}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {allUsers.filter(u => u.role !== 'admin').length > 0 && (
              <div className="px-6 pb-6 flex justify-end">
                <Button onClick={handlePublishRatings} disabled={publishingRatings} className="gap-2">
                  <Trophy className="h-4 w-4" />
                  {publishingRatings ? 'Publishing…' : 'Publish Ratings'}
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-6">
          {/* Create announcement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Post an Announcement
              </CardTitle>
              <CardDescription>
                Announcements are visible to all members of your organisation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="announcementTitle">Title</Label>
                <Input
                  id="announcementTitle"
                  placeholder="Announcement title…"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <RichTextEditor
                  value={announcementContent}
                  onChange={setAnnouncementContent}
                  placeholder="Write your announcement here…"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handlePostAnnouncement} disabled={postingAnnouncement} className="gap-2">
                  <Megaphone className="h-4 w-4" />
                  {postingAnnouncement ? 'Posting…' : 'Post Announcement'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing announcements */}
          <div className="space-y-3">
            {announcements.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No announcements posted yet.</p>
                </CardContent>
              </Card>
            ) : (
              announcements.map((ann) => (
                <Card key={ann.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{ann.title}</h3>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(ann.created_at), 'dd MMM yyyy')}
                          </span>
                        </div>
                        <div
                          className="text-sm text-muted-foreground prose prose-sm max-w-none line-clamp-3"
                          dangerouslySetInnerHTML={{ __html: ann.content }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={userDialog.open} onOpenChange={(open) => {
        if (!open) {
          setUserDialog({ open: false, mode: 'create', user: null });
          setUserForm({
            email: '',
            password: '',
            fullName: '',
            role: 'employee',
            managerId: '',
            timezone: 'UTC',
          });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {userDialog.mode === 'create' ? 'Add New User' : 'Edit User'}
            </DialogTitle>
            <DialogDescription>
              {userDialog.mode === 'create' 
                ? 'Create a new user account for your organization' 
                : 'Update user information'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email {userDialog.mode === 'create' && '(required)'}</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required={userDialog.mode === 'create'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {userDialog.mode === 'create' ? '(required)' : '(leave blank to keep current)'}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={userDialog.mode === 'edit' ? 'Leave blank to keep current' : 'Enter password'}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                required={userDialog.mode === 'create'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name (required)</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={userForm.fullName}
                onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={userForm.role} 
                onValueChange={(value: any) => setUserForm({ ...userForm, role: value })}
                disabled={userDialog.user?.id === user?.id}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager">Manager (optional)</Label>
              <Select 
                value={userForm.managerId || NO_MANAGER_VALUE}
                onValueChange={(value) =>
                  setUserForm({
                    ...userForm,
                    managerId: value === NO_MANAGER_VALUE ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER_VALUE}>None</SelectItem>
                  {allUsers.filter(u => 
                    (u.role === 'manager' || u.role === 'admin') && 
                    u.id !== userDialog.user?.id
                  ).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select 
                value={userForm.timezone} 
                onValueChange={(value) => setUserForm({ ...userForm, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                  <SelectItem value="America/Chicago">America/Chicago (CST)</SelectItem>
                  <SelectItem value="America/Denver">America/Denver (MST)</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los Angeles (PST)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                  <SelectItem value="Australia/Sydney">Australia/Sydney (AEST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setUserDialog({ open: false, mode: 'create', user: null })}
            >
              Cancel
            </Button>
            <Button 
              onClick={userDialog.mode === 'create' ? handleCreateUser : handleUpdateUser} 
              disabled={submitting || !userForm.fullName || (userDialog.mode === 'create' && (!userForm.email || !userForm.password))}
            >
              {submitting ? "Saving..." : userDialog.mode === 'create' ? "Create User" : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialog.open} onOpenChange={(open) => {
        if (!open) {
          setTaskDialog({ open: false, mode: 'create', task: null });
          setTaskForm({
            title: '',
            description: '',
            type: 'daily',
            dayOfWeek: '',
            dueDate: '',
            assignmentType: 'common',
            assignedTo: '',
            isActive: true,
            isNumericTask: false,
            numericUnit: '',
            linkedMonthlyTaskId: '',
          });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {taskDialog.mode === 'create' ? 'Create New Task' : 'Edit Task'}
            </DialogTitle>
            <DialogDescription>
              {taskDialog.mode === 'create' 
                ? 'Create a new task for your organization' 
                : 'Update task information'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Title (required)</Label>
              <Input
                id="taskTitle"
                type="text"
                placeholder="Task title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskDescription">Description (optional)</Label>
              <Textarea
                id="taskDescription"
                placeholder="Task description"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskType">Type</Label>
              <Select 
                value={taskForm.type} 
                onValueChange={(value: any) => setTaskForm({ ...taskForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {taskForm.type === 'weekly' && (
              <div className="space-y-2">
                <Label htmlFor="dayOfWeek">Day of Week</Label>
                <Select 
                  value={taskForm.dayOfWeek} 
                  onValueChange={(value) => setTaskForm({ ...taskForm, dayOfWeek: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {taskForm.type === 'monthly' && (
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Assignment Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="common"
                    checked={taskForm.assignmentType === 'common'}
                    onChange={(e) => setTaskForm({ ...taskForm, assignmentType: 'common', assignedTo: '' })}
                  />
                  <span className="text-sm">Common Task (All Employees)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="specific"
                    checked={taskForm.assignmentType === 'specific'}
                    onChange={(e) => setTaskForm({ ...taskForm, assignmentType: 'specific' })}
                  />
                  <span className="text-sm">Specific Employee</span>
                </label>
              </div>
            </div>

            {taskForm.assignmentType === 'specific' && (
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assign To</Label>
                <Select 
                  value={taskForm.assignedTo} 
                  onValueChange={(value) => setTaskForm({ ...taskForm, assignedTo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={taskForm.isActive}
                onChange={(e) => setTaskForm({ ...taskForm, isActive: e.target.checked })}
              />
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isNumericTask"
                checked={taskForm.isNumericTask}
                onChange={(e) => setTaskForm({ ...taskForm, isNumericTask: e.target.checked })}
              />
              <Label htmlFor="isNumericTask" className="cursor-pointer">Numeric Task</Label>
            </div>

            {taskForm.isNumericTask && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="numericUnit">Unit Label (e.g., "certificates", "items")</Label>
                  <Input
                    id="numericUnit"
                    type="text"
                    placeholder="certificates"
                    value={taskForm.numericUnit}
                    onChange={(e) => setTaskForm({ ...taskForm, numericUnit: e.target.value })}
                  />
                </div>

                {taskForm.type === 'daily' && (
                  <div className="space-y-2">
                    <Label htmlFor="linkedMonthlyTask">Link to Monthly Task (optional)</Label>
                    <Select 
                      value={taskForm.linkedMonthlyTaskId || NO_LINKED_MONTHLY_VALUE}
                      onValueChange={(value) =>
                        setTaskForm({
                          ...taskForm,
                          linkedMonthlyTaskId: value === NO_LINKED_MONTHLY_VALUE ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select monthly task for auto-calculation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_LINKED_MONTHLY_VALUE}>None</SelectItem>
                        {allTasks.filter(t => t.type === 'monthly' && t.is_numeric_task).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Daily numeric values will automatically sum into the linked monthly task
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setTaskDialog({ open: false, mode: 'create', task: null })}
            >
              Cancel
            </Button>
            <Button 
              onClick={taskDialog.mode === 'create' ? handleCreateTask : handleUpdateTask} 
              disabled={submitting || !taskForm.title}
            >
              {submitting ? "Saving..." : taskDialog.mode === 'create' ? "Create Task" : "Update Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mistakeDialog.open} onOpenChange={(open) => {
        if (!open) {
          setMistakeDialog({ open: false, mode: 'create', mistake: null });
          setMistakeForm({ title: '', description: '', severity: 'medium', userId: '' });
        }
      }}>
        <DialogContent className="max-w-md">
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
                type="text"
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
                  {allUsers.filter(u => u.role === 'employee').map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
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
                rows={4}
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
              disabled={submitting || !mistakeForm.description || !mistakeForm.userId}
            >
              {submitting ? "Saving..." : mistakeDialog.mode === 'create' ? "Record Mistake" : "Update Mistake"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
