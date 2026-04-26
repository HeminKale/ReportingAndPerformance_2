"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import type { Task } from "@/lib/types/database";

interface TaskLogDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
}

export function TaskLogDialog({ task, open, onOpenChange, date }: TaskLogDialogProps) {
  const params = useParams();
  const [status, setStatus] = useState<'completed' | 'pending'>('completed');
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [numericValue, setNumericValue] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStatus('completed');
      setComment('');
      setReason('');
      setNumericValue('');
    }
  }, [open]);
  const { toast } = useToast();
  const supabase = createClient();

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const taskLogData: any = {
        task_id: task.id,
        user_id: user.id,
        organization_id: task.organization_id,
        date,
        status,
        verification_status: 'pending',
        submitted_at: new Date().toISOString(),
      };

      if (task.is_numeric_task) {
        const numValue = parseFloat(numericValue);
        if (isNaN(numValue) || numValue < 0) {
          throw new Error("Please enter a valid positive number");
        }
        taskLogData.numeric_value = numValue;
        taskLogData.comment = comment || null;
      } else {
        taskLogData.comment = status === 'completed' ? comment : null;
        taskLogData.reason = status === 'pending' ? reason : null;
      }

      const { error } = await supabase
        .from('task_logs')
        .upsert(taskLogData, { onConflict: 'task_id,user_id,date' })
        .select('id')
        .single();

      if (error) throw error;

      const { data: submittedTaskLog } = await supabase
        .from("task_logs")
        .select("id")
        .eq("task_id", task.id)
        .eq("user_id", user.id)
        .eq("date", date)
        .single();

      // Best-effort manager notification on employee submission.
      // If no manager is assigned (manager_id is null), skip silently.
      // Do not block employee submission if notification insert fails.
      const { data: submittingUser } = await supabase
        .from('users')
        .select('full_name, manager_id')
        .eq('id', user.id)
        .single();

      if (submittingUser?.manager_id) {
        const employeeComment =
          task.is_numeric_task
            ? (comment || "").trim() || null
            : status === "completed"
              ? (comment || "").trim() || null
              : (reason || "").trim() || null;
        const commentLabel = task.is_numeric_task
          ? "Note"
          : status === "completed"
            ? "Comment"
            : "Reason (pending)";

        const managerMessage = `${submittingUser.full_name} submitted "${task.title}" as ${status} and it is waiting for your review.`;
        const { error: managerNotificationError } = await supabase
          .from('notifications')
          .insert({
            organization_id: task.organization_id,
            user_id: submittingUser.manager_id,
            type: 'task_verification',
            title: 'Task Submitted for Review',
            message: managerMessage,
            link: `/org/${String(params.orgSlug)}/manager`,
            metadata: {
              actionable: true,
              resource_type: "task_log",
              resource_id: submittedTaskLog?.id ?? null,
              employee_id: user.id,
              task_id: task.id,
              employee_comment: employeeComment,
              employee_comment_label: commentLabel,
            },
          });

        if (managerNotificationError) {
          console.warn("Failed to create manager notification:", managerNotificationError.message);
        }
      }

      toast({
        title: "Task logged",
        description: task.is_numeric_task 
          ? `Submitted ${numericValue} ${task.numeric_unit || 'units'}`
          : `Task marked as ${status}`,
      });

      onOpenChange(false);
      setComment("");
      setReason("");
      setNumericValue("");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task.is_numeric_task ? `Enter Number: ${task.title}` : `Log Task: ${task.title}`}</DialogTitle>
          <DialogDescription>
            {task.is_numeric_task
              ? `Enter the number${task.numeric_unit ? ` of ${task.numeric_unit}` : ''} completed today.${task.linked_monthly_task_id ? ' This will be added to your monthly total.' : ''}`
              : 'Mark this task as completed or pending'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {task.is_numeric_task ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="numericValue">
                  Number{task.numeric_unit ? ` (${task.numeric_unit})` : ''} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="numericValue"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Enter number${task.numeric_unit ? ` of ${task.numeric_unit}` : ''}…`}
                  value={numericValue}
                  onChange={(e) => setNumericValue(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comment">Comment (optional)</Label>
                <Textarea
                  id="comment"
                  placeholder="Add any additional notes..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={status === 'completed' ? 'default' : 'outline'}
                    onClick={() => setStatus('completed')}
                    className="flex-1"
                  >
                    Completed
                  </Button>
                  <Button
                    type="button"
                    variant={status === 'pending' ? 'default' : 'outline'}
                    onClick={() => setStatus('pending')}
                    className="flex-1"
                  >
                    Pending
                  </Button>
                </div>
              </div>

              {status === 'completed' ? (
                <div className="space-y-2">
                  <Label htmlFor="comment">Comment (required)</Label>
                  <Textarea
                    id="comment"
                    placeholder="Describe what you accomplished..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (required)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Explain why this task is pending..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (task.is_numeric_task ? !numericValue : (status === 'completed' && !comment) || (status === 'pending' && !reason))}
          >
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
