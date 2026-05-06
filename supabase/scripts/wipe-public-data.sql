-- =============================================================================
-- DEV / QA ONLY — wipes application rows in public schema (keeps migrations).
-- Run in Supabase SQL Editor on a NON-PRODUCTION project, or via psql locally.
--
-- After this script:
--   1) Remove Auth users (Dashboard → Authentication → Users, or run the
--      optional block at the bottom if your role allows DELETE on auth.users).
--   2) Create new Auth users (email/password or magic link).
--   3) Insert matching rows in public.organizations and public.users (id must
--      equal auth.users.id). See supabase/seed.sql for shape.
--
-- Optional local CLI: from repo root, if you use Supabase CLI with linked project:
--   supabase db reset   -- reapplies ALL migrations + runs supabase/seed.sql
-- =============================================================================

BEGIN;

TRUNCATE TABLE
  xp_ledger,
  user_gamification,
  leaderboard_daily,
  manager_periodic_dispatches,
  manager_periodic_tasks,
  task_logs,
  leaderboard,
  mistakes,
  audit_logs,
  notifications,
  attendance,
  leaves,
  enquiries,
  trainings,
  salary_records,
  employee_documents,
  employee_details,
  alumni_details,
  tasks,
  users,
  organizations
RESTART IDENTITY CASCADE;

COMMIT;

-- -----------------------------------------------------------------------------
-- OPTIONAL: clear Supabase Auth identities so logins match fresh public.users.
-- May fail if your database role cannot delete from auth schema; use Dashboard
-- instead to delete users, then create new ones.
-- -----------------------------------------------------------------------------
-- DELETE FROM auth.identities;
-- DELETE FROM auth.users;
