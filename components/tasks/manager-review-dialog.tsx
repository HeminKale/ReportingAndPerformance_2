"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { markResourceNotificationsRead } from "@/lib/notifications/mark-resource-read";
import { requestNotificationsBellRefresh } from "@/lib/notifications/refresh-bell";
import type { Task, TaskLog, User } from "@/lib/types/database";

interface ManagerReviewDialogProps {
  task: Task;
  taskLog: TaskLog;
  employee: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagerReviewDialog({ task, taskLog, employee, open, onOpenChange }: ManagerReviewDialogProps) {
  const [reviewComment, setReviewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useParams() as { orgSlug?: string };
  const orgSlug = params.orgSlug ?? "";
  const { toast } = useToast();
  const supabase = createClient();

  const handleReview = async (action: 'approve' | 'reject') => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('task_logs')
        .update({
          verification_status: action === 'approve' ? 'approved' : 'rejected',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          manager_review_comment: reviewComment || null,
        })
        .eq('id', taskLog.id);

      if (error) throw error;

      await markResourceNotificationsRead(supabase, user.id, "task_log", String(taskLog.id));

      requestNotificationsBellRefresh();

      const mgr = reviewComment.trim();
      await supabase.from("notifications").insert({
        organization_id: task.organization_id,
        user_id: taskLog.user_id,
        type: action === "approve" ? "task_approved" : "task_rejected",
        title: action === "approve" ? "Task approved" : "Task rejected",
        message:
          action === "approve"
            ? `Your task "${task.title}" was approved.${mgr ? ` Manager comment: ${mgr}` : ""}`
            : `Your task "${task.title}" was rejected.${mgr ? ` Manager comment: ${mgr}` : ""}`,
        link: orgSlug ? `/org/${orgSlug}/tasks` : null,
        metadata: {
          actionable: false,
          resource_type: "task_log",
          resource_id: String(taskLog.id),
          manager_comment: mgr || null,
        },
      });

      toast({
        title: "Success",
        description: `Task ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      onOpenChange(false);
      setReviewComment("");
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Task Submission</DialogTitle>
          <DialogDescription>
            Review and approve or reject this task submission
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Employee</p>
              <p className="text-sm">{employee.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Task</p>
              <p className="text-sm">{task.title}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <Badge className="mt-1">
                {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Submitted At</p>
              <p className="text-sm">
                {taskLog.submitted_at 
                  ? format(new Date(taskLog.submitted_at), 'HH:mm dd/MM/yyyy')
                  : format(new Date(taskLog.created_at), 'HH:mm dd/MM/yyyy')}
              </p>
            </div>
          </div>

          {task.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Task Description</p>
              <p className="text-sm">{task.description}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Employee Submission</p>
            
            {task.is_numeric_task ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Value:</p>
                  <Badge className="bg-blue-100 text-blue-800">
                    {taskLog.numeric_value} {task.numeric_unit || 'units'}
                  </Badge>
                </div>
                {taskLog.comment && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Comment:</p>
                    <p className="text-sm mt-1">{taskLog.comment}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Status:</p>
                  <Badge className={taskLog.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {taskLog.status.charAt(0).toUpperCase() + taskLog.status.slice(1)}
                  </Badge>
                </div>
                
                {taskLog.status === 'completed' && taskLog.comment && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Comment:</p>
                    <p className="text-sm mt-1">{taskLog.comment}</p>
                  </div>
                )}
                
                {taskLog.status === 'pending' && taskLog.reason && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reason:</p>
                    <p className="text-sm mt-1">{taskLog.reason}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewComment">Manager Review Comment (optional)</Label>
            <Textarea
              id="reviewComment"
              placeholder="Add your review comments..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={() => handleReview('reject')}
            disabled={loading}
          >
            {loading ? "Processing..." : "Reject"}
          </Button>
          <Button 
            onClick={() => handleReview('approve')}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "Processing..." : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
