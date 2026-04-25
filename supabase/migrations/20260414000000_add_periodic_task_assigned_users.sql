-- Add assigned_user_ids column to manager_periodic_tasks to allow selective team member assignment
-- NULL or empty array means assign to all direct reports (backward compatibility)
-- Non-empty array means assign only to those specific user IDs

ALTER TABLE manager_periodic_tasks 
ADD COLUMN assigned_user_ids UUID[] DEFAULT NULL;

CREATE INDEX idx_manager_periodic_tasks_assigned_users 
ON manager_periodic_tasks USING GIN(assigned_user_ids) 
WHERE assigned_user_ids IS NOT NULL;

COMMENT ON COLUMN manager_periodic_tasks.assigned_user_ids IS 
'Array of user IDs to assign this periodic task to. NULL or empty array = all direct reports.';
