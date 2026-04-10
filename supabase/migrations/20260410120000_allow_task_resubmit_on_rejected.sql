-- Allow employees to resubmit their own rejected task logs.
-- This supports the UI flow where a rejected task can be edited and submitted again.
ALTER POLICY "Users can update their own unverified task logs"
ON task_logs
USING (
  organization_id = get_user_org()
  AND user_id = auth.uid()
  AND verification_status IN ('pending', 'rejected')
);
