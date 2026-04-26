"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, Edit2 } from "lucide-react";
import type { Leave, User } from "@/lib/types/database";

export default function LeavesPage() {
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    type: 'full_day' as 'full_day' | 'half_day',
    leaveType: 'vacation' as 'vacation' | 'sick' | 'personal',
    reason: '',
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

    const { data: leavesData } = await supabase
      .from('leaves')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false });

    setUser(userData);
    setLeaves(leavesData || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || !formData.startDate || !formData.endDate || !formData.reason.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast({
        title: "Invalid date range",
        description: "End date cannot be earlier than start date",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      let leaveId = editingLeaveId;

      const leavePayload = {
        start_date: formData.startDate,
        end_date: formData.endDate,
        type: formData.type,
        leave_type: formData.leaveType,
        reason: formData.reason,
        status: 'pending',
        manager_comment: null, // Reset manager comment on re-submission
      };

      if (editingLeaveId) {
        const { error } = await supabase
          .from('leaves')
          .update(leavePayload)
          .eq('id', editingLeaveId);

        if (error) throw error;
      } else {
        const { data: createdLeave, error } = await supabase
          .from('leaves')
          .insert({
            user_id: user.id,
            organization_id: user.organization_id,
            ...leavePayload,
          })
          .select("id")
          .single();

        if (error) throw error;
        leaveId = createdLeave?.id;
      }

      if (user.manager_id) {
        await supabase
          .from('notifications')
          .insert({
            organization_id: user.organization_id,
            user_id: user.manager_id,
            type: 'leave_approval',
            title: editingLeaveId ? 'Leave Request Updated' : 'Leave Request',
            message: `${user.full_name} has requested leave from ${format(new Date(formData.startDate), 'MMM d')} to ${format(new Date(formData.endDate), 'MMM d')}`,
            link: `/org/${String(params.orgSlug)}/manager`,
            metadata: {
              actionable: true,
              resource_type: "leave",
              resource_id: leaveId ?? null,
              employee_id: user.id,
              employee_comment: formData.reason.trim(),
              employee_comment_label: "Reason",
            },
          });
      }

      toast({
        title: editingLeaveId ? "Leave request updated" : "Leave request submitted",
        description: "Your manager will review your request",
      });

      handleCloseDialog();
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

  const handleEdit = (leave: Leave) => {
    setEditingLeaveId(leave.id);
    setFormData({
      startDate: leave.start_date,
      endDate: leave.end_date,
      type: leave.type,
      leaveType: leave.leave_type,
      reason: leave.reason,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLeaveId(null);
    setFormData({
      startDate: '',
      endDate: '',
      type: 'full_day',
      leaveType: 'vacation',
      reason: '',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground">
            Request and manage your leaves
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Leave
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dates</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Manager Comment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.length > 0 ? (
                  leaves.map((leave) => (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(new Date(leave.start_date), 'MMM d, yyyy')} - {format(new Date(leave.end_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="capitalize whitespace-nowrap">
                        {leave.type.replace('_', ' ')}
                      </TableCell>
                      <TableCell className="capitalize whitespace-nowrap">
                        {leave.leave_type}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] lg:max-w-[300px] truncate" title={leave.reason}>
                          {leave.reason}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(leave.status)}>
                          {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] lg:max-w-[300px] truncate text-sm text-muted-foreground" title={leave.manager_comment || ""}>
                          {leave.manager_comment || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(leave)}>
                          <Edit2 className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <CalendarIcon className="h-10 w-10 mb-2 opacity-20" />
                        <p>No leave requests</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLeaveId ? 'Edit Leave Request' : 'Request Leave'}</DialogTitle>
            <DialogDescription>
              Submit a leave request for manager approval
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    const startDate = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      startDate,
                      endDate: prev.endDate && prev.endDate < startDate ? startDate : prev.endDate,
                    }));
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  min={formData.startDate || undefined}
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Leave Type</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_day">Full Day</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leaveType">Category</Label>
              <Select value={formData.leaveType} onValueChange={(value: any) => setFormData({ ...formData, leaveType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea
                id="reason"
                placeholder="Explain the reason for your leave..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !formData.startDate || !formData.endDate || !formData.reason.trim()}
            >
              {submitting ? "Submitting..." : editingLeaveId ? "Update Request" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
