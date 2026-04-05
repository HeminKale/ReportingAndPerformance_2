"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [status, setStatus] = useState<'completed' | 'pending'>('completed');
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('task_logs')
        .upsert({
          task_id: task.id,
          user_id: user.id,
          organization_id: task.organization_id,
          date,
          status,
          comment: status === 'completed' ? comment : null,
          reason: status === 'pending' ? reason : null,
          verification_status: 'pending',
        });

      if (error) throw error;

      toast({
        title: "Task logged",
        description: `Task marked as ${status}`,
      });

      onOpenChange(false);
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
          <DialogTitle>Log Task: {task.title}</DialogTitle>
          <DialogDescription>
            Mark this task as completed or pending
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || (status === 'completed' && !comment) || (status === 'pending' && !reason)}
          >
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
