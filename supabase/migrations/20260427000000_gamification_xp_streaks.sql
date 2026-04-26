-- Gamification: task priority, XP ledger, user streaks/XP/badges

DO $$
BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS priority task_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assignment_xp_override INTEGER NULL;

COMMENT ON COLUMN tasks.assignment_xp_override IS 'NULL = use priority-based XP (see app xp-rules); set to override including 0 for no per-task bonus.';

ALTER TABLE manager_periodic_tasks
  ADD COLUMN IF NOT EXISTS priority task_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assignment_xp_override INTEGER NULL;

CREATE TABLE IF NOT EXISTS user_gamification (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_streak_qualifying_date DATE NULL,
  last_streak_eval_date DATE NULL,
  earned_badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_gamification_org ON user_gamification(organization_id);

CREATE TABLE IF NOT EXISTS xp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_user_created ON xp_ledger(user_id, created_at DESC);

CREATE TRIGGER update_user_gamification_updated_at
  BEFORE UPDATE ON user_gamification
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own gamification" ON user_gamification;
CREATE POLICY "Users read own gamification"
  ON user_gamification FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own xp ledger" ON xp_ledger;
CREATE POLICY "Users read own xp ledger"
  ON xp_ledger FOR SELECT
  USING (user_id = auth.uid());

-- Writes via service role (API routes); no INSERT/UPDATE for authenticated clients
