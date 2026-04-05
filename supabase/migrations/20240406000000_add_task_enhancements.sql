-- Migration: Add task enhancements for numeric values, submission timestamps, and manager review

-- 1. Add new columns to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS is_numeric_task BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS numeric_unit TEXT,
ADD COLUMN IF NOT EXISTS linked_monthly_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- 2. Add new columns to task_logs table
ALTER TABLE task_logs
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS numeric_value NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS manager_review_comment TEXT;

-- 3. Update the CHECK constraint on task_logs to handle numeric tasks
ALTER TABLE task_logs
DROP CONSTRAINT IF EXISTS task_logs_check;

ALTER TABLE task_logs
ADD CONSTRAINT task_logs_check CHECK (
    (status = 'completed' AND (comment IS NOT NULL OR numeric_value IS NOT NULL)) OR
    (status = 'pending' AND reason IS NOT NULL)
);

-- 4. Create index for numeric tasks and monthly aggregation
CREATE INDEX IF NOT EXISTS idx_task_logs_numeric ON task_logs(task_id, date) WHERE numeric_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_linked_monthly ON tasks(linked_monthly_task_id) WHERE linked_monthly_task_id IS NOT NULL;

-- 5. Create a function to auto-calculate monthly numeric task totals
CREATE OR REPLACE FUNCTION calculate_monthly_numeric_total(
    p_user_id UUID,
    p_daily_task_id UUID,
    p_month DATE
)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(numeric_value), 0)
    INTO v_total
    FROM task_logs
    WHERE user_id = p_user_id
    AND task_id = p_daily_task_id
    AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
    AND numeric_value IS NOT NULL;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- 6. Create a function to auto-submit monthly numeric task
CREATE OR REPLACE FUNCTION auto_submit_monthly_numeric_task()
RETURNS TRIGGER AS $$
DECLARE
    v_monthly_task_id UUID;
    v_monthly_total NUMERIC;
    v_month_date DATE;
BEGIN
    -- Get the linked monthly task
    SELECT linked_monthly_task_id
    INTO v_monthly_task_id
    FROM tasks
    WHERE id = NEW.task_id;
    
    -- Only proceed if there's a linked monthly task and this is a numeric submission
    IF v_monthly_task_id IS NOT NULL AND NEW.numeric_value IS NOT NULL THEN
        -- Get the month start date
        v_month_date := DATE_TRUNC('month', NEW.date)::DATE;
        
        -- Calculate the total for the month
        v_monthly_total := calculate_monthly_numeric_total(
            NEW.user_id,
            NEW.task_id,
            v_month_date
        );
        
        -- Insert or update the monthly task log
        INSERT INTO task_logs (
            organization_id,
            task_id,
            user_id,
            date,
            status,
            comment,
            numeric_value,
            verification_status,
            submitted_at
        )
        VALUES (
            NEW.organization_id,
            v_monthly_task_id,
            NEW.user_id,
            v_month_date,
            'completed',
            'Auto-calculated from daily submissions',
            v_monthly_total,
            'pending',
            NOW()
        )
        ON CONFLICT (task_id, user_id, date)
        DO UPDATE SET
            numeric_value = v_monthly_total,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to auto-calculate monthly totals
DROP TRIGGER IF EXISTS trigger_auto_monthly_numeric ON task_logs;
CREATE TRIGGER trigger_auto_monthly_numeric
    AFTER INSERT OR UPDATE OF numeric_value
    ON task_logs
    FOR EACH ROW
    EXECUTE FUNCTION auto_submit_monthly_numeric_task();

-- 8. Add comments to explain new columns
COMMENT ON COLUMN tasks.is_numeric_task IS 'Indicates if this task requires a numeric value instead of just completed/pending';
COMMENT ON COLUMN tasks.numeric_unit IS 'Unit of measurement for numeric tasks (e.g., "certificates", "items", "hours")';
COMMENT ON COLUMN tasks.linked_monthly_task_id IS 'For daily numeric tasks, links to the monthly aggregation task';
COMMENT ON COLUMN task_logs.submitted_at IS 'Timestamp when the task was submitted by the employee';
COMMENT ON COLUMN task_logs.numeric_value IS 'Numeric value for tasks that track quantities';
COMMENT ON COLUMN task_logs.manager_review_comment IS 'Optional comment from manager during review';
