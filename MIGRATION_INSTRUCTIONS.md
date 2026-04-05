# Migration Instructions - Task Enhancements

## Quick Start (3 Steps)

### Step 1: Run the Migration

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/20240406000000_add_task_enhancements.sql`
6. Paste into SQL Editor
7. Click **Run** or press Ctrl+Enter
8. Wait for "Success. No rows returned" message

### Step 2: Verify Migration Succeeded

Run this verification query in SQL Editor:

```sql
-- Should return 3 rows
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'tasks'
AND column_name IN ('is_numeric_task', 'numeric_unit', 'linked_monthly_task_id');
```

Expected result: 3 rows showing the new columns.

### Step 3: Test the Application

1. Start dev server: `npm run dev`
2. Log in as Admin
3. Go to Settings → Task Assignment
4. Create a task - you should now see "Numeric Task" checkbox
5. Go to Tasks page - you should see tabular format

## What This Migration Does

### Adds to `tasks` Table
- `is_numeric_task` - Boolean flag for numeric tasks
- `numeric_unit` - Unit label (e.g., "certificates")
- `linked_monthly_task_id` - Links daily to monthly task

### Adds to `task_logs` Table
- `submitted_at` - Submission timestamp
- `numeric_value` - Numeric value for quantitative tasks
- `manager_review_comment` - Manager's review notes

### Creates Database Functions
- `calculate_monthly_numeric_total()` - Calculates monthly sums
- `auto_submit_monthly_numeric_task()` - Auto-creates monthly logs

### Creates Database Trigger
- `trigger_auto_monthly_numeric` - Fires when numeric value submitted

## Rollback (If Needed)

If something goes wrong, run this to rollback:

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS trigger_auto_monthly_numeric ON task_logs;

-- Drop functions
DROP FUNCTION IF EXISTS auto_submit_monthly_numeric_task();
DROP FUNCTION IF EXISTS calculate_monthly_numeric_total(UUID, UUID, DATE);

-- Drop columns from task_logs
ALTER TABLE task_logs DROP COLUMN IF EXISTS manager_review_comment;
ALTER TABLE task_logs DROP COLUMN IF EXISTS numeric_value;
ALTER TABLE task_logs DROP COLUMN IF EXISTS submitted_at;

-- Drop columns from tasks
ALTER TABLE tasks DROP COLUMN IF EXISTS linked_monthly_task_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS numeric_unit;
ALTER TABLE tasks DROP COLUMN IF EXISTS is_numeric_task;

-- Restore original CHECK constraint
ALTER TABLE task_logs DROP CONSTRAINT IF EXISTS task_logs_check;
ALTER TABLE task_logs ADD CONSTRAINT task_logs_check CHECK (
    (status = 'completed' AND comment IS NOT NULL) OR
    (status = 'pending' AND reason IS NOT NULL)
);
```

## Common Issues

### Issue: "column already exists"

**Cause**: Migration was partially run before

**Solution**: The migration uses `IF NOT EXISTS`, so it's safe to run again. If you see this error, the column already exists and you can proceed.

### Issue: "constraint does not exist"

**Cause**: Trying to drop a constraint that doesn't exist

**Solution**: This is expected if running for the first time. The migration handles this gracefully.

### Issue: Trigger not firing

**Check**:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trigger_auto_monthly_numeric';
```

**Solution**: If trigger doesn't exist, re-run the trigger creation part of the migration.

## Testing the Trigger

After migration, test the auto-calculation:

```sql
-- Get IDs
SELECT id, title FROM tasks WHERE title LIKE '%Certificates%';

-- Insert a test daily numeric task log
INSERT INTO task_logs (
  organization_id,
  task_id,
  user_id,
  date,
  status,
  numeric_value,
  submitted_at
)
VALUES (
  'your-org-id',
  'daily-task-id',
  'your-user-id',
  CURRENT_DATE,
  'completed',
  5.0,
  NOW()
);

-- Check if monthly task log was created
SELECT * FROM task_logs 
WHERE task_id = 'monthly-task-id' 
AND user_id = 'your-user-id';

-- Should show numeric_value = 5.0
```

## Post-Migration Checklist

- [ ] Migration ran without errors
- [ ] Verification query returns 3 rows for tasks table
- [ ] Verification query returns 3 rows for task_logs table
- [ ] Functions created (2 functions)
- [ ] Trigger created
- [ ] Dev server starts without errors
- [ ] Settings page shows numeric task checkbox
- [ ] Tasks page shows tabular format
- [ ] Can create numeric task
- [ ] Can submit numeric task
- [ ] Monthly total auto-calculates
- [ ] Manager can review tasks
- [ ] Submission timestamps display correctly

## Support

If you encounter issues:
1. Check `Reference Docs/TROUBLESHOOTING.md`
2. Review Supabase logs
3. Check browser console for errors
4. Verify environment variables are set

---

**Migration File**: `supabase/migrations/20240406000000_add_task_enhancements.sql`
**Status**: Ready to run
**Estimated Time**: < 1 minute
