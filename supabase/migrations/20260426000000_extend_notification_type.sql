-- Extended notification_type for task assignment + mistake events.
-- Idempotent: IF NOT EXISTS requires PostgreSQL 9.1+ (Supabase 15+).
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_assigned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'mistake_logged';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'mistake_rectified';
