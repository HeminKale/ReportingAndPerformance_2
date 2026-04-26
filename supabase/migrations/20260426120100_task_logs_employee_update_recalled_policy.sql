-- Runs in a separate transaction after verification_status includes 'recalled'.
-- Allow employees to resubmit when log is pending, rejected, or recalled (manager undo).

DROP POLICY IF EXISTS "Users can update their own unverified task logs" ON task_logs;

CREATE POLICY "Users can update their own unverified task logs"
  ON task_logs FOR UPDATE
  USING (
    organization_id = get_user_org()
    AND user_id = auth.uid()
    AND verification_status IN ('pending', 'rejected', 'recalled')
  );
