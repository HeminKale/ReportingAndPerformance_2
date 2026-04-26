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
import { Plus, Pencil, Trash2, Users as UsersIcon, ListTodo, ChevronDown, ChevronUp, Eye, AlertTriangle, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { TaskAssignmentPanel } from "@/components/shared/task-assignment-panel";
import { format } from "date-fns";
import type { User, Task, Announcement } from "@/lib/types/database";

/** Radix Select.Item must not use value=""; map sentinels to "" in form state */
const NO_MANAGER_VALUE = "__no_manager__";
export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allMistakes, setAllMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [mistakeSearchTerm, setMistakeSearchTerm] = useState("");
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

  const [mistakeForm, setMistakeForm] = useState({
    title: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    userId: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

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
          title: mistakeForm.title.trim(),
          description: mistakeForm.description,
          severity: mistakeForm.severity,
          date: new Date().toISOString().split('T')[0],
          status: 'open',
          closure_request_pending: false,
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
          title: mistakeForm.title.trim(),
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
      title: mistake.title || '',
      description: mistake.description || '',
      severity: mistake.severity || 'medium',
      userId: mistake.user_id || '',
    });
    setMistakeDialog({ open: true, mode: 'edit', mistake });
  };

  const filteredUsers = allUsers.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMistakes = allMistakes.filter(m => 
    m.description?.toLowerCase().includes(mistakeSearchTerm.toLowerCase()) ||
    m.users?.full_name?.toLowerCase().includes(mistakeSearchTerm.toLowerCase())
  );

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
          {user && (
            <TaskAssignmentPanel
              mode="admin"
              organizationId={user.organization_id}
              currentUserId={user.id}
              assignableUsers={allUsers}
              tasks={allTasks}
              monthlyNumericLinkOptions={allTasks.filter(
                (t) => t.type === "monthly" && t.is_numeric_task
              )}
              monthlyPeriodicLinkOptions={[]}
              onTasksChanged={fetchData}
            />
          )}
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
