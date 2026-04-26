-- Task verification: new enum values only.
-- Must commit before any statement can reference 'recalled' (PostgreSQL 55P04).
-- Policy change lives in 20260426120100_task_logs_employee_update_recalled_policy.sql

ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'recalled';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_recalled';
