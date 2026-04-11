-- Link daily periodic numeric templates to monthly periodic templates (resolved to tasks.id at cron).
-- Also tag materialized tasks with their source periodic template for lookups.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_manager_periodic_task_id UUID REFERENCES manager_periodic_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_source_periodic_template
  ON tasks (source_manager_periodic_task_id)
  WHERE source_manager_periodic_task_id IS NOT NULL;

COMMENT ON COLUMN tasks.source_manager_periodic_task_id IS
  'Set when this task row was created from a manager_periodic_tasks template (cron). Used to resolve linked_monthly_periodic_id on daily templates.';

ALTER TABLE manager_periodic_tasks
  ADD COLUMN IF NOT EXISTS linked_monthly_periodic_id UUID REFERENCES manager_periodic_tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN manager_periodic_tasks.linked_monthly_periodic_id IS
  'For daily numeric periodic templates only: optional monthly periodic template to roll up into. Mutually exclusive with linked_monthly_task_id in app; resolved to tasks.linked_monthly_task_id when cron materializes daily rows.';

CREATE INDEX IF NOT EXISTS idx_manager_periodic_linked_monthly_periodic
  ON manager_periodic_tasks (linked_monthly_periodic_id)
  WHERE linked_monthly_periodic_id IS NOT NULL;
