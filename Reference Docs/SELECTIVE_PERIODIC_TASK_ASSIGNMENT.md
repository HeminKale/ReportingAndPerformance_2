# Selective Periodic Task Assignment Feature

## Overview

This feature allows managers to assign periodic tasks to **selected team members** instead of automatically assigning them to all direct reports. Managers can choose specific employees or leave the selection empty to apply the task to everyone.

**Implementation Date**: April 14, 2026

**See also:** [PERIODIC_TASKS_ARCHITECTURE.md](PERIODIC_TASKS_ARCHITECTURE.md) — full lifecycle (cron, instant materialize on create, Vercel Hobby limits, `CRON_SECRET`, scenarios).

---

## Key Features

### 1. Flexible Assignment Options
- **Select specific members**: Choose one or more team members for the periodic task
- **Assign to all**: Leave selection empty to automatically assign to all direct reports
- **Visual feedback**: Table shows how many members are assigned to each periodic task

### 2. User Interface
- Checkbox interface similar to normal task creation
- "Select all" button for quick selection of all team members
- "Clear (assign to all)" button to reset to automatic assignment
- Display shows "All direct reports" or "X members" in the periodic tasks table

### 3. Backward Compatibility
- Existing periodic tasks continue to work (assigned to all direct reports)
- NULL or empty array = assign to all members
- No breaking changes to existing functionality

---

## Database Schema

### Table: `manager_periodic_tasks`

**New Column**: `assigned_user_ids`
- **Type**: `UUID[]` (array of user IDs)
- **Default**: `NULL`
- **Nullable**: Yes
- **Index**: GIN index for efficient querying

**Behavior**:
- `NULL` or empty array `[]` → Assign to all direct reports
- Non-empty array `[uuid1, uuid2, ...]` → Assign only to specified users

### Migration SQL

Run this in Supabase SQL Editor:

```sql
ALTER TABLE manager_periodic_tasks 
ADD COLUMN assigned_user_ids UUID[] DEFAULT NULL;

CREATE INDEX idx_manager_periodic_tasks_assigned_users 
ON manager_periodic_tasks USING GIN(assigned_user_ids) 
WHERE assigned_user_ids IS NOT NULL;

COMMENT ON COLUMN manager_periodic_tasks.assigned_user_ids IS 
'Array of user IDs to assign this periodic task to. NULL or empty array = all direct reports.';
```

---

## How It Works

### 1. Creating/Editing Periodic Tasks

**Location**: Manager Panel → Task Assignment Tab → Periodic Tasks

**Steps**:
1. Click "Create periodic task" button
2. Fill in task details (name, description, type, schedule)
3. In "Assign to" section:
   - **Leave empty** to assign to all direct reports (default)
   - **Check specific members** to assign only to those employees
   - Use "Select all" to quickly select everyone
   - Use "Clear (assign to all)" to reset to automatic assignment
4. Save the periodic task

**UI Features**:
- Scrollable checkbox list of all direct reports
- Shows member name and role
- Real-time count of selected members
- Help text explaining empty selection behavior

### 2. Periodic Tasks Table

The periodic tasks table displays:
- **Name**: Task title
- **Description**: Task description
- **Assigned to**: 
  - "All direct reports" (italic, muted) - when no specific selection
  - "1 member" or "X members" - when specific members selected
- **Schedule detail**: When the task runs (daily, weekly, monthly)
- **Numeric / link**: Whether it's a numeric task
- **Enabled**: Toggle to enable/disable automation
- **Actions**: Edit and delete buttons

### 3. Materialization (cron + instant on create)

Shared logic lives in **`lib/cron/periodic-tasks-materialize.ts`** (`materializePeriodicTemplates`). Both paths insert `tasks` rows and **`manager_periodic_dispatches`** so the same period is never duplicated.

**A) Scheduled cron** — `app/api/cron/periodic-tasks/route.ts`  
- **Auth:** `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret` (same value as env).  
- Loads **all enabled** templates org-wide, then runs materialization for each due period.

**B) Instant bootstrap (create only)** — `POST /api/manager/periodic-tasks/materialize`  
- After an **enabled** template is **created**, the UI calls this route with `{ "templateId": "<uuid>" }` (session cookie).  
- Materializes the **current period** if it matches today’s rules (e.g. weekly only on the chosen weekday). **Edit** does not trigger this.  
- Requires **`SUPABASE_SERVICE_ROLE_KEY`** on the server (same as cron).

**Per-template member resolution** (unchanged):
1. If `assigned_user_ids` is set and non-empty → only those user IDs, verified still direct reports in the same org.
2. If `NULL` or empty → all direct reports of the manager.
3. Skips task creation if no valid members found.

Details: [PERIODIC_TASKS_ARCHITECTURE.md](PERIODIC_TASKS_ARCHITECTURE.md).

---

## Usage Examples

### Example 1: Daily Task for Specific Team Members

**Scenario**: "Update client records" task should only be assigned to 2 account managers out of 10 team members.

**Setup**:
1. Create daily periodic task
2. Title: "Update client records"
3. Select only the 2 account managers from the list
4. Enable the task

**Result**: Cron job creates the task only for those 2 members every day.

### Example 2: Weekly Task for All Members

**Scenario**: "Weekly team report" should go to all direct reports.

**Setup**:
1. Create weekly periodic task
2. Title: "Weekly team report"
3. Leave member selection empty (or click "Clear (assign to all)")
4. Enable the task

**Result**: Cron job creates the task for all direct reports every week.

### Example 3: Converting Existing Task to Selective

**Scenario**: Change an existing "all members" periodic task to specific members only.

**Steps**:
1. Go to Periodic Tasks tab
2. Click edit icon on the task
3. Select specific team members
4. Save

**Result**: Next cron run will only create tasks for selected members.

---

## Technical Implementation

### Files Modified

1. **Database Migration**
   - `supabase/migrations/20260414000000_add_periodic_task_assigned_users.sql`
   - Adds `assigned_user_ids` column with GIN index

2. **TypeScript Types**
   - `lib/types/database.ts`
   - Added `assigned_user_ids?: string[] | null` to `ManagerPeriodicTask`

3. **UI Component**
   - `components/shared/manager-periodic-tasks-tab.tsx`
   - Added checkbox UI for member selection
   - Updated table to show assignment info
   - Updated form handling

4. **Parent Component**
   - `components/shared/task-assignment-panel.tsx`
   - Passes `assignableUsers` to periodic tasks tab

5. **Cron route**
   - `app/api/cron/periodic-tasks/route.ts` — auth + calls shared materialize

6. **Shared materialize + instant API**
   - `lib/cron/periodic-tasks-materialize.ts`
   - `app/api/manager/periodic-tasks/materialize/route.ts`

7. **Vercel schedule**
   - `vercel.json` — Hobby plan: at most once per day (see architecture doc)

### Type Definitions

```typescript
export interface ManagerPeriodicTask {
  id: string;
  organization_id: string;
  manager_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  day_of_week: number | null;
  monthly_day: number | null;
  is_numeric_task: boolean;
  numeric_unit: string | null;
  linked_monthly_task_id: string | null;
  linked_monthly_periodic_id?: string | null;
  assigned_user_ids?: string[] | null;  // NEW
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

---

## Comparison: Normal Tasks vs. Periodic Tasks

| Feature | Normal Tasks | Periodic Tasks |
|---------|-------------|----------------|
| **Assignment** | Required - must select members | Optional - empty = all members |
| **When Created** | Immediately on save | Enabled **create**: instant materialize if the current period is due; then ongoing runs via **cron** (see architecture doc) |
| **Selection UI** | Checkboxes | Checkboxes (same as normal) |
| **"All Members" Option** | Admin only (common tasks) | Leave selection empty |
| **Edit After Creation** | Edit individual task | Edit template (affects future) |
| **Visibility** | Current/History tabs | Periodic Tasks tab |

---

## Best Practices

### When to Use Selective Assignment

1. **Role-Specific Tasks**: Tasks that only apply to certain roles
   - Example: "Review code" for developers only
   - Example: "Update client records" for account managers only

2. **Project-Based Tasks**: Tasks for team members on specific projects
   - Example: "Update Project X status" for Project X team

3. **Training Tasks**: Tasks for new or specific team members
   - Example: "Complete onboarding module" for new hires

### When to Use "All Members" (Empty Selection)

1. **General Tasks**: Tasks that apply to everyone
   - Example: "Daily standup attendance"
   - Example: "Weekly timesheet submission"

2. **Team-Wide Tasks**: Company or department-wide requirements
   - Example: "Monthly safety training"
   - Example: "Quarterly feedback survey"

---

## Troubleshooting

### Issue: Task Not Created for Selected Members

**Possible Causes**:
1. Selected members are no longer direct reports
2. Selected members were removed from the organization
3. Periodic task is disabled

**Solution**:
- Edit the periodic task and verify selected members are still in the list
- Check if task is enabled
- Review cron job logs

### Issue: Task Created for Wrong Members

**Possible Causes**:
1. `assigned_user_ids` not properly saved
2. Cached data in UI

**Solution**:
- Refresh the page
- Re-edit the task and verify selection
- Check database directly: `SELECT assigned_user_ids FROM manager_periodic_tasks WHERE id = 'task-id'`

### Issue: "All Members" Not Working

**Possible Causes**:
1. `assigned_user_ids` is an empty array `[]` instead of `NULL`

**Solution**:
- Click "Clear (assign to all)" button
- Verify the database shows `NULL` (not `[]`)

### Issue: Cron never runs / `curl` returns HTML “Authentication Required”

**Possible Causes**:
1. Vercel **Deployment Protection** (SSO) blocks anonymous requests before they reach Next.js
2. `CRON_SECRET` or `vercel.json` cron not configured on **Production**
3. Hobby plan: invalid schedule (more than once per day)

**Solution**:
- See [PERIODIC_TASKS_ARCHITECTURE.md](PERIODIC_TASKS_ARCHITECTURE.md) and Vercel [protection bypass for automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
- Confirm **Cron Jobs** in the Vercel project and server logs return JSON `{ "ok": true, ... }`

**Working `curl` against a protected production URL** (use your real host and export both secrets first):

```bash
export CRON_SECRET='...'   # same as Vercel env CRON_SECRET
export VERCEL_AUTOMATION_BYPASS_SECRET='...'   # Protection bypass secret from Vercel dashboard
curl -s \
  -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  -H "Authorization: Bearer $CRON_SECRET" \
  'https://YOUR-PROJECT.vercel.app/api/cron/periodic-tasks'
```

---

## Migration Guide

### For Existing Periodic Tasks

**No action required!** Existing periodic tasks will continue to work as before:
- `assigned_user_ids` column defaults to `NULL`
- Cron job treats `NULL` as "assign to all direct reports"
- All existing tasks remain backward compatible

### For New Projects

1. Run the migration SQL in Supabase
2. Deploy updated code
3. No configuration changes needed
4. Feature is automatically available to all managers

---

## API Reference

### Cron endpoint

**URL**: `/api/cron/periodic-tasks`  
**Method**: `GET` or `POST`  
**Auth**: `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`

**Response**:
```json
{
  "ok": true,
  "templatesProcessed": 5,
  "taskRowsCreated": 15,
  "skipped": 2,
  "at": "2026-04-14T10:00:00.000Z"
}
```

### Manager instant materialize (after create)

**URL**: `/api/manager/periodic-tasks/materialize`  
**Method**: `POST`  
**Auth**: Logged-in user (session cookie). Caller must be **manager** or **admin** and own the template (`manager_id`).

**Body**:
```json
{ "templateId": "uuid-of-manager_periodic_tasks-row" }
```

**Response** (example):
```json
{
  "ok": true,
  "templatesProcessed": 1,
  "taskRowsCreated": 3,
  "skipped": 0
}
```

Server must have **`SUPABASE_SERVICE_ROLE_KEY`** (writes `manager_periodic_dispatches` and `tasks` like cron).

### Database Queries

**Get all periodic tasks with selective assignment**:
```sql
SELECT 
  pt.*,
  CASE 
    WHEN pt.assigned_user_ids IS NULL THEN 'All direct reports'
    ELSE CAST(array_length(pt.assigned_user_ids, 1) AS TEXT) || ' members'
  END as assignment_display
FROM manager_periodic_tasks pt
WHERE manager_id = 'manager-uuid'
ORDER BY created_at DESC;
```

**Get tasks for specific member**:
```sql
SELECT pt.*
FROM manager_periodic_tasks pt
WHERE manager_id = 'manager-uuid'
  AND (
    pt.assigned_user_ids IS NULL 
    OR 'user-uuid' = ANY(pt.assigned_user_ids)
  );
```

---

## Security Considerations

### Row Level Security (RLS)

The existing RLS policies on `manager_periodic_tasks` remain unchanged:
- Managers can only view/edit their own periodic tasks
- `assigned_user_ids` can only reference users in the same organization
- Cron job uses service role key to bypass RLS

### Validation

1. **UI Level**: Only shows manager's direct reports in checkbox list
2. **Cron Level**: Verifies selected users are still direct reports before creating tasks
3. **Database Level**: No foreign key constraint (allows flexibility, validated at runtime)

---

## Performance Considerations

### Database Index

GIN index on `assigned_user_ids` enables efficient queries:
```sql
-- Fast query for tasks assigned to specific user
WHERE 'user-uuid' = ANY(assigned_user_ids)

-- Fast query for tasks with selective assignment
WHERE assigned_user_ids IS NOT NULL
```

### Cron Job Optimization

- Fetches all templates in single query
- Batches task creation per template
- Uses idempotency log to prevent duplicates
- Processes monthly templates before daily (for rollup links)

---

## Future Enhancements

Potential improvements for future versions:

1. **Bulk Edit**: Select multiple periodic tasks and change assignments together
2. **Assignment Templates**: Save common team member groupings
3. **Assignment History**: Track when assignment changes were made
4. **Notification**: Alert when selected members leave the team
5. **Analytics**: Report showing which members have most/least periodic tasks

---

## Related Features

- **[Periodic tasks architecture](PERIODIC_TASKS_ARCHITECTURE.md)**: Cron, instant create, period keys, Vercel Hobby  
- **[Periodic cron on VPS / Hostinger](PERIODIC_TASKS_CRON_HOSTINGER_VPS.md)**: Linux `cron` + `curl`, no `vercel.json`
- **Normal Task Assignment**: Similar checkbox UI for immediate task creation
- **Daily Periodic Monthly Rollup**: Numeric daily tasks can roll up to monthly
- **Task Verification**: Managers verify completed tasks from team members
- **Common Tasks (Admin)**: Admin-level tasks for all employees (different from manager periodic tasks)

---

## Support

For questions or issues:
1. Check troubleshooting section above
2. Review cron job logs in Vercel/deployment platform
3. Verify database migration was applied successfully
4. Check browser console for UI errors

---

**Document Version**: 1.1  
**Last Updated**: April 26, 2026  
**Feature Status**: Production Ready
