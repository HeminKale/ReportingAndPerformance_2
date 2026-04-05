"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Users, Settings, Plus, Trash2 } from "lucide-react";
import type { User, Organization } from "@/lib/types/database";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    fullName: '',
    role: 'employee' as 'admin' | 'manager' | 'employee',
    managerId: '',
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

    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', userData.organization_id)
      .single();

    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', userData.organization_id)
      .order('created_at', { ascending: false });

    setUser(userData);
    setOrganization(orgData);
    setAllUsers(users || []);
    setLoading(false);
  };

  const handleCreateUser = async () => {
    if (!user || !newUser.email || !newUser.fullName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      toast({
        title: "Info",
        description: "User creation requires Supabase Auth setup. Please create users through Supabase dashboard and then add them to the users table.",
      });
      
      setUserDialogOpen(false);
      setNewUser({
        email: '',
        fullName: '',
        role: 'employee',
        managerId: '',
      });
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
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

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

  const handleUpdateOrgSettings = async (settings: any) => {
    if (!organization) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ settings })
        .eq('id', organization.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization settings updated",
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
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">
          Manage your organization and users
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users ({allUsers.length})</TabsTrigger>
          <TabsTrigger value="settings">Organization Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setUserDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          {allUsers.length > 0 ? (
            <div className="space-y-4">
              {allUsers.map((u) => (
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
                        </div>
                      </div>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No users</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add users to your organization
                </p>
                <Button onClick={() => setUserDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>
                Configure your organization preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input value={organization?.name || ''} disabled />
              </div>
              
              <div className="space-y-2">
                <Label>Organization Slug</Label>
                <Input value={organization?.slug || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label>Default Timezone</Label>
                <Input value={organization?.timezone || 'UTC'} disabled />
              </div>

              <div className="space-y-2">
                <Label>Clock-In Cutoff Time</Label>
                <Input 
                  value={organization?.settings?.clock_in_cutoff || '09:15'} 
                  placeholder="09:15"
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Employees clocking in after this time will need manager approval
                </p>
              </div>

              <div className="space-y-4">
                <Label>Features</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={organization?.settings?.features?.leaderboard || false}
                      disabled
                      className="rounded"
                    />
                    <span className="text-sm">Leaderboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={organization?.settings?.features?.mistakes || false}
                      disabled
                      className="rounded"
                    />
                    <span className="text-sm">Mistake Tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={organization?.settings?.features?.leaves || false}
                      disabled
                      className="rounded"
                    />
                    <span className="text-sm">Leave Management</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground italic">
                Note: Organization settings can be modified directly in the database or through a future settings update interface.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account for your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (required)</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name (required)</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={newUser.fullName}
                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUser.role} onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}>
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
              <Select value={newUser.managerId} onValueChange={(value) => setNewUser({ ...newUser, managerId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.filter(u => u.role === 'manager' || u.role === 'admin').map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                Note: Users must first be created in Supabase Auth. This interface is for demonstration purposes.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateUser} 
              disabled={submitting || !newUser.email || !newUser.fullName}
            >
              {submitting ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
