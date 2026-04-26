-- Extended notification_type for task assignment + mistake events (idempotent)
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'task_assigned'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'task_assigned';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'mistake_logged'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'mistake_logged';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type' AND e.enumlabel = 'mistake_rectified'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'mistake_rectified';
  END IF;
END
$migration$;
