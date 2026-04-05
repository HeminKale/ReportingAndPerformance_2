# Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "New row violates row-level security policy for table 'organizations'"

**Symptom**: Signup fails with RLS policy error

**Root Cause**: 
- After `auth.signUp()`, the session isn't immediately established
- `auth.uid()` returns NULL in RLS policy checks
- INSERT operations fail

**Solution**: ✅ FIXED
- Implemented server-side signup API route (`/api/auth/signup`)
- Uses service role key to bypass RLS during signup
- Automatically signs in user after account creation

**What was changed**:
- Created `app/api/auth/signup/route.ts`
- Updated `app/(auth)/signup/page.tsx` to use API route
- Signup now works reliably

---

### Issue 2: Auth User Created But No Organization/User Record

**Symptom**: 
- Auth user exists in `auth.users`
- No record in `organizations` table
- No record in `users` table

**Diagnosis Queries**:
```sql
-- Check counts
SELECT 
    'Auth Users' as source, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Public Users', COUNT(*) FROM users
UNION ALL
SELECT 'Organizations', COUNT(*) FROM organizations;
```

**Solution**:
- This was caused by the RLS issue above
- Fixed by implementing server-side signup API
- If you have orphaned auth users, clean them up:

```sql
-- Delete orphaned auth users
DELETE FROM auth.users 
WHERE id NOT IN (SELECT id FROM users);
```

---

### Issue 3: Cannot Access Dashboard After Login

**Symptom**: Redirects to login or shows error after successful login

**Possible Causes**:
1. User doesn't exist in `users` table
2. Organization doesn't exist
3. Organization slug mismatch

**Diagnosis**:
```sql
-- Check if user exists with correct org
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    o.slug as org_slug,
    o.name as org_name
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE u.email = 'your-email@example.com';
```

**Solution**:
- Ensure user exists in `users` table
- Verify `organization_id` matches an existing organization
- Check organization slug is correct

---

### Issue 4: Notifications Not Appearing in Real-Time

**Symptom**: Notifications don't update without page refresh

**Solution**:
1. Enable Supabase Realtime for `notifications` table:
   - Go to Supabase Dashboard
   - Database → Replication
   - Find `notifications` table
   - Enable replication

2. Verify WebSocket connection:
   - Open browser console
   - Look for WebSocket connection to Supabase
   - Should see `wss://` connection

---

### Issue 5: Clock-In Validation Not Working

**Symptom**: Can clock in after 9:15 AM without late request

**Diagnosis**:
```sql
-- Check user's timezone
SELECT id, email, timezone FROM users WHERE email = 'your-email';
```

**Solution**:
- Ensure user's timezone is set correctly
- Default is 'UTC' - update if needed:

```sql
UPDATE users 
SET timezone = 'America/New_York'  -- or your timezone
WHERE email = 'your-email';
```

---

### Issue 6: Manager Cannot See Team Members

**Symptom**: Manager panel shows "No team members"

**Diagnosis**:
```sql
-- Check manager-employee relationships
SELECT 
    e.full_name as employee,
    e.email as employee_email,
    m.full_name as manager,
    m.email as manager_email
FROM users e
LEFT JOIN users m ON e.manager_id = m.id
WHERE e.manager_id IS NOT NULL;
```

**Solution**:
- Ensure employees have `manager_id` set:

```sql
UPDATE users 
SET manager_id = 'manager-uuid-here'
WHERE id = 'employee-uuid-here';
```

---

### Issue 7: Tasks Not Showing on Dashboard

**Symptom**: Dashboard shows "No tasks for today"

**Diagnosis**:
```sql
-- Check if tasks exist
SELECT 
    t.id,
    t.title,
    t.type,
    t.is_common_task,
    t.assigned_to,
    t.is_active
FROM tasks t
WHERE t.organization_id = 'your-org-uuid';
```

**Solution**:
- Create tasks (as admin/manager):

```sql
-- Create a daily common task
INSERT INTO tasks (organization_id, title, description, type, assigned_by, is_common_task, is_active)
VALUES (
    'your-org-uuid',
    'Daily Standup',
    'Post your daily update',
    'daily',
    'your-admin-uuid',
    true,
    true
);
```

---

### Issue 8: Cannot Clock Out

**Symptom**: Clock out button disabled or shows error

**Cause**: System checks if all daily tasks are completed

**Diagnosis**:
```sql
-- Check today's task logs
SELECT 
    tl.status,
    t.title,
    t.type
FROM task_logs tl
JOIN tasks t ON tl.task_id = t.id
WHERE tl.user_id = 'your-user-uuid'
AND tl.date = CURRENT_DATE;
```

**Solution**:
- Complete all daily tasks before clocking out
- Or mark them as pending with a reason

---

### Issue 9: Environment Variables Not Working

**Symptom**: "Invalid API key" or connection errors

**Diagnosis**:
```bash
# Check if .env.local exists and has values
cat .env.local
```

**Solution**:
- Verify all three variables are set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Restart dev server after changing `.env.local`
- For Vercel deployment, add variables in dashboard

---

### Issue 10: RLS Policies Too Restrictive

**Symptom**: "Permission denied" or "Row level security policy violated"

**Diagnosis**:
```sql
-- Check user's role
SELECT id, email, role, organization_id FROM users WHERE email = 'your-email';

-- Check RLS policies for a table
SELECT * FROM pg_policies WHERE tablename = 'table_name';
```

**Solution**:
- Verify user has correct role (admin/manager/employee)
- Check if user belongs to the organization
- Review RLS policies in `supabase/migrations/20240101000001_rls_policies.sql`

---

## 🔧 **Useful Diagnostic Queries**

### Check Complete System State
```sql
SELECT 
    'Organizations' as entity, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'Task Logs', COUNT(*) FROM task_logs
UNION ALL
SELECT 'Attendance', COUNT(*) FROM attendance
UNION ALL
SELECT 'Leaves', COUNT(*) FROM leaves
UNION ALL
SELECT 'Notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'Leaderboard', COUNT(*) FROM leaderboard
UNION ALL
SELECT 'Mistakes', COUNT(*) FROM mistakes;
```

### Check User's Complete Profile
```sql
SELECT 
    u.*,
    o.name as org_name,
    o.slug as org_slug,
    o.timezone as org_timezone,
    m.full_name as manager_name
FROM users u
JOIN organizations o ON u.organization_id = o.id
LEFT JOIN users m ON u.manager_id = m.id
WHERE u.email = 'your-email';
```

### Check All Pending Approvals
```sql
-- Pending task verifications
SELECT COUNT(*) as pending_tasks
FROM task_logs 
WHERE verification_status = 'pending';

-- Pending attendance approvals
SELECT COUNT(*) as pending_attendance
FROM attendance 
WHERE is_late_request = true AND approval_status = 'pending';

-- Pending leave requests
SELECT COUNT(*) as pending_leaves
FROM leaves 
WHERE status = 'pending';
```

---

## 🆘 **Still Having Issues?**

1. **Check Supabase logs**:
   - Go to Supabase Dashboard
   - Logs → API Logs
   - Look for error messages

2. **Check browser console**:
   - Open Developer Tools (F12)
   - Look for JavaScript errors
   - Check Network tab for failed requests

3. **Verify environment variables**:
   - Make sure all three Supabase keys are correct
   - Check for typos or extra spaces

4. **Test RLS policies**:
   - Use Supabase SQL Editor
   - Run queries as different users
   - Verify policies work as expected

---

## 📚 **Additional Resources**

- **Setup Guide**: `Reference Docs/SETUP.md`
- **Deployment Guide**: `Reference Docs/DEPLOYMENT.md`
- **Next Steps**: `NEXT_STEPS.md`
- **Supabase RLS Docs**: https://supabase.com/docs/guides/auth/row-level-security

---

## ✅ **Quick Health Check**

Run this to verify everything is working:

```sql
-- Should return true for all
SELECT 
    EXISTS(SELECT 1 FROM organizations) as has_organizations,
    EXISTS(SELECT 1 FROM users) as has_users,
    EXISTS(SELECT 1 FROM users WHERE role = 'admin') as has_admin,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'organizations') > 0 as has_org_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users') > 0 as has_user_policies;
```

Expected result after successful setup:
- `has_organizations`: true
- `has_users`: true
- `has_admin`: true
- `has_org_policies`: true
- `has_user_policies`: true
