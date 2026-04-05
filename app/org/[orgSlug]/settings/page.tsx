"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Plus, Pencil, Trash2, Users as UsersIcon, ListTodo } from "lucide-react";
import type { User, Task } from "@/lib/types/database";

/** Radix Select.Item must not use value=""; map this to no manager in form state */
const NO_MANAGER_VALUE = "__no_manager__";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [taskSearchTerm, setTaskSearchTerm] = useState("");
  
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

  const [submitting, setSubmitting] = useState(false);
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

    setUser(userData);
    setAllUsers(users || []);
    setAllTasks(tasks || []);
    setLoading(false);
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
      email: userToEdit.email,
      password: '',
      fullName: userToEdit.full_name,
      role: userToEdit.role,
      managerId: userToEdit.manager_id || '',
      timezone: userToEdit.timezone,
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

  const openEditTaskDialog = (taskToEdit: Task) => {
    const assignedUser = allUsers.find(u => u.id === taskToEdit.assigned_to);
    setTaskForm({
      title: taskToEdit.title,
      description: taskToEdit.description || '',
      type: taskToEdit.type,
      dayOfWeek: taskToEdit.day_of_week?.toString() || '',
      dueDate: taskToEdit.due_date || '',
      assignmentType: taskToEdit.is_common_task ? 'common' : 'specific',
      assignedTo: taskToEdit.assigned_to || '',
      isActive: taskToEdit.is_active,
      isNumericTask: taskToEdit.is_numeric_task,
      numericUnit: taskToEdit.numeric_unit || '',
      linkedMonthlyTaskId: taskToEdit.linked_monthly_task_id || '',
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

          {filteredTasks.length > 0 ? (
            <div className="space-y-4">
              {filteredTasks.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{t.title}</h3>
                          {!t.is_active && (
                            <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                              Inactive
                            </span>
                          )}
                          {t.is_numeric_task && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                              Numeric
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-sm text-muted-foreground mb-2">{t.description}</p>
                        )}
                        <div className="flex gap-4 text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                          </span>
                          <span className="text-muted-foreground">
                            {t.is_common_task ? 'Common Task (All Employees)' : `Assigned to: ${allUsers.find(u => u.id === t.assigned_to)?.full_name || 'Unknown'}`}
                          </span>
                          {t.type === 'weekly' && t.day_of_week && (
                            <span className="text-muted-foreground">
                              Day: {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.day_of_week]}
                            </span>
                          )}
                          {t.type === 'monthly' && t.due_date && (
                            <span className="text-muted-foreground">
                              Due: {t.due_date}
                            </span>
                          )}
                          {t.is_numeric_task && t.numeric_unit && (
                            <span className="text-muted-foreground">
                              Unit: {t.numeric_unit}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditTaskDialog(t)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTask(t.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <ListTodo className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {taskSearchTerm ? 'Try a different search term' : 'Create tasks to assign to your team'}
                </p>
              </CardContent>
            </Card>
          )}
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
                      value={taskForm.linkedMonthlyTaskId} 
                      onValueChange={(value) => setTaskForm({ ...taskForm, linkedMonthlyTaskId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select monthly task for auto-calculation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
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
    </div>
  );
}
