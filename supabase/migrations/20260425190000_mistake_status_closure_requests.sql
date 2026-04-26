-- Mistake tracker status (open | rectified) and closure request workflow.
-- Apply with: `supabase db push` or paste this file into Supabase Dashboard → SQL Editor → Run.
--
-- Quick verification queries (after migration):
--   SELECT id, user_id, status, closure_request_pending, title FROM mistakes LIMIT 20;
--   SELECT proname FROM pg_proc WHERE proname = 'request_mistake_closure';

ALTER TABLE mistakes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS closure_request_pending BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE mistakes
  DROP CONSTRAINT IF EXISTS mistakes_status_check;

ALTER TABLE mistakes
  ADD CONSTRAINT mistakes_status_check CHECK (status IN ('open', 'rectified'));

ALTER TABLE mistakes
  DROP CONSTRAINT IF EXISTS mistakes_rectified_no_pending;

ALTER TABLE mistakes
  ADD CONSTRAINT mistakes_rectified_no_pending CHECK (NOT (status = 'rectified' AND closure_request_pending));

CREATE INDEX IF NOT EXISTS idx_mistakes_closure_pending ON mistakes (organization_id, closure_request_pending)
  WHERE closure_request_pending = true;

-- Allow managers who oversee the employee (not only the creator) to approve closure.
DROP POLICY IF EXISTS "Managers can update mistakes they created" ON mistakes;
DROP POLICY IF EXISTS "Managers can update team mistakes" ON mistakes;

CREATE POLICY "Managers can update team mistakes"
  ON mistakes FOR UPDATE
  USING (
    organization_id = get_user_org()
    AND is_manager()
    AND (
      added_by = auth.uid()
      OR user_id IN (SELECT id FROM get_team_members(auth.uid()))
    )
  )
  WITH CHECK (
    organization_id = get_user_org()
    AND is_manager()
    AND (
      added_by = auth.uid()
      OR user_id IN (SELECT id FROM get_team_members(auth.uid()))
    )
  );

-- Employees request closure via RPC (avoids broad UPDATE grants).
CREATE OR REPLACE FUNCTION public.request_mistake_closure(p_mistake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r mistakes%ROWTYPE;
BEGIN
  SELECT * INTO r FROM mistakes WHERE id = p_mistake_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF r.organization_id <> get_user_org() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF r.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_open');
  END IF;
  IF r.closure_request_pending THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending');
  END IF;

  UPDATE mistakes
  SET closure_request_pending = true
  WHERE id = p_mistake_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.request_mistake_closure(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_mistake_closure(uuid) TO authenticated;
