# Testing Guide - Manager Panel & Settings Enhancements

## Quick Start Testing

### Prerequisites
1. Dev server running: `npm run dev`
2. At least 3 users in database:
   - 1 Admin
   - 1 Manager
   - 1 Employee

## Test Scenarios

### Scenario 1: Employee Access Control

**Login as**: Employee

**Expected Behavior**:
- Can see: Dashboard, Tasks, Attendance, Leaves, Notifications, Calendar, Leaderboard, Mistakes
- Cannot see: Manager Panel, Settings
- Sidebar should not show Manager Panel or Settings links

**Test Steps**:
1. Log in as employee
2. Check sidebar navigation
3. Try to manually navigate to `/org/[orgSlug]/manager` - should show access denied
4. Try to manually navigate to `/org/[orgSlug]/settings` - should show access denied

### Scenario 2: Manager Access Control

**Login as**: Manager

**Expected Behavior**:
- Can see: All employee pages + Manager Panel
- Cannot see: Settings
- Sidebar should show Manager Panel but not Settings

**Test Steps**:
1. Log in as manager
2. Check sidebar navigation
3. Access Manager Panel - should work
4. Try to manually navigate to `/org/[orgSlug]/settings` - should show access denied
5. Test search in Manager Panel:
   - Go to Task Verifications tab
   - Enter employee name in search
   - Verify filtering works
   - Repeat for Attendance, Leaves, and Team tabs

### Scenario 3: Admin Access Control

**Login as**: Admin

**Expected Behavior**:
- Can see: All employee pages + Settings
- Cannot see: Manager Panel (admins use Settings instead)
- Sidebar should show Settings but not Manager Panel

**Test Steps**:
1. Log in as admin
2. Check sidebar navigation
3. Access Settings - should work
4. Manager Panel should not be visible in sidebar

### Scenario 4: User Management (Admin)

**Login as**: Admin

**Test Create User**:
1. Go to Settings → Users tab
2. Click "Add User"
3. Fill in form:
   - Email: test@example.com
   - Password: Test123!
   - Full Name: Test User
   - Role: Employee
   - Manager: Select a manager
   - Timezone: America/New_York
4. Click "Create User"
5. Verify user appears in list
6. Check Supabase:
   - Auth Users table should have new entry
   - Public Users table should have new entry

**Test Edit User**:
1. Click edit icon on a user
2. Change full name
3. Change role
4. Click "Update User"
5. Verify changes appear in list
6. Check Supabase to confirm updates

**Test Delete User**:
1. Click delete icon on a user (not yourself)
2. Confirm deletion
3. Verify user removed from list
4. Check Supabase:
   - Auth Users table should not have entry
   - Public Users table should not have entry

**Test Search**:
1. Enter user name in search box
2. Verify list filters correctly
3. Clear search
4. Enter email in search box
5. Verify list filters correctly

### Scenario 5: Task Management (Admin)

**Login as**: Admin

**Test Create Common Task**:
1. Go to Settings → Task Assignment tab
2. Click "Create Task"
3. Fill in form:
   - Title: Daily Standup
   - Description: Post your daily update
   - Type: Daily
   - Assignment Type: Common Task
   - Active: Checked
4. Click "Create Task"
5. Verify task appears in list
6. Check that it shows "Common Task (All Employees)"

**Test Create Specific Task**:
1. Click "Create Task"
2. Fill in form:
   - Title: Code Review
   - Type: Weekly
   - Day of Week: Monday
   - Assignment Type: Specific Employee
   - Assign To: Select an employee
4. Click "Create Task"
5. Verify task shows assigned employee name

**Test Edit Task**:
1. Click edit icon on a task
2. Change title
3. Change from common to specific
4. Click "Update Task"
5. Verify changes appear

**Test Delete Task**:
1. Click delete icon on a task
2. Confirm deletion
3. Verify task removed from list

**Test Search**:
1. Enter task title in search box
2. Verify list filters correctly

### Scenario 6: Manager Hierarchy

**Setup**: Create hierarchy
- Manager 1 (Senior Manager)
- Manager 2 (Reports to Manager 1)
- Employee 1-10 (Report to Manager 2)

**Test Manager 1 Access**:
1. Log in as Manager 1
2. Go to Manager Panel
3. Verify you see:
   - Manager 2's pending items
   - All 10 employees' pending items
4. Search for Manager 2's name - should find their items
5. Search for Employee 5's name - should find their items

**Test Manager 2 Access**:
1. Log in as Manager 2
2. Go to Manager Panel
3. Verify you see:
   - Only the 10 employees' pending items
   - NOT Manager 1's items (they're above in hierarchy)
4. Search for Employee 3's name - should find their items

### Scenario 7: Organization Isolation

**Setup**: Create 2 organizations with users

**Test**:
1. Log in as Admin from Org 1
2. Go to Settings → Users
3. Verify you only see users from Org 1
4. Try to create a user - should be added to Org 1
5. Log out and log in as Admin from Org 2
6. Verify you only see users from Org 2
7. Verify Org 1 users are not visible

### Scenario 8: Self-Protection

**Login as**: Admin

**Test Cannot Delete Self**:
1. Go to Settings → Users
2. Find your own user card
3. Verify delete button is not shown

**Test Cannot Change Own Role**:
1. Click edit on your own user
2. Verify role dropdown is disabled

## API Testing

### Test Create User API

```bash
# Get your session token from browser DevTools → Application → Cookies
curl -X POST http://localhost:3000/api/auth/create-user \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "email": "newuser@example.com",
    "password": "Test123!",
    "fullName": "New User",
    "role": "employee",
    "timezone": "UTC"
  }'
```

**Expected**: `{ "success": true, "userId": "..." }`

### Test Update User API

```bash
curl -X PATCH http://localhost:3000/api/auth/update-user \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "userId": "user-uuid-here",
    "fullName": "Updated Name",
    "role": "manager"
  }'
```

**Expected**: `{ "success": true }`

### Test Delete User API

```bash
curl -X DELETE http://localhost:3000/api/auth/delete-user \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "userId": "user-uuid-here"
  }'
```

**Expected**: `{ "success": true }`

## Database Verification

After each test, verify in Supabase:

### Check Auth Users
```sql
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Public Users
```sql
SELECT u.id, u.email, u.full_name, u.role, o.slug as org_slug
FROM users u
JOIN organizations o ON u.organization_id = o.id
ORDER BY u.created_at DESC
LIMIT 5;
```

### Check Tasks
```sql
SELECT id, title, type, is_common_task, assigned_to, is_active
FROM tasks
ORDER BY created_at DESC
LIMIT 5;
```

### Check Manager Hierarchy
```sql
SELECT 
    e.full_name as employee,
    m.full_name as manager
FROM users e
LEFT JOIN users m ON e.manager_id = m.id
WHERE e.manager_id IS NOT NULL
ORDER BY m.full_name, e.full_name;
```

## Common Issues & Solutions

### Issue: "Access denied" when accessing Manager Panel
**Solution**: Verify user role is 'manager' in database

### Issue: "Access denied" when accessing Settings
**Solution**: Verify user role is 'admin' in database

### Issue: Cannot create user - "Only admins can create users"
**Solution**: Verify you're logged in as admin

### Issue: Search not working
**Solution**: Clear browser cache and refresh page

### Issue: User created but not showing in list
**Solution**: Refresh the page or check browser console for errors

### Issue: Task not assigned to employee
**Solution**: Verify assignment type is set correctly and employee is selected

## Performance Testing

### Load Test Users Tab
1. Create 50+ users in organization
2. Navigate to Settings → Users
3. Verify page loads in < 2 seconds
4. Test search with 50+ users
5. Verify search is responsive

### Load Test Tasks Tab
1. Create 100+ tasks
2. Navigate to Settings → Task Assignment
3. Verify page loads in < 2 seconds
4. Test search with 100+ tasks
5. Verify search is responsive

## Security Testing

### Test Unauthorized Access
1. Log out
2. Try to access `/api/auth/create-user`
3. Expected: 401 Unauthorized

### Test Cross-Organization Access
1. Get user ID from Org 1
2. Log in as Admin from Org 2
3. Try to delete user from Org 1 via API
4. Expected: 403 Forbidden

### Test Role Escalation
1. Log in as Manager
2. Try to access Settings page
3. Expected: Access denied

## Checklist

- [ ] Employee cannot see Manager Panel or Settings
- [ ] Manager can see Manager Panel only
- [ ] Admin can see Settings only
- [ ] Search works in all Manager Panel tabs
- [ ] Admin can create users
- [ ] Admin can edit users
- [ ] Admin can delete users (except self)
- [ ] Admin cannot change own role
- [ ] Admin can create common tasks
- [ ] Admin can create specific tasks
- [ ] Admin can edit tasks
- [ ] Admin can delete tasks
- [ ] Manager 1 sees all downstream team members
- [ ] Manager 2 sees only direct reports
- [ ] Organization isolation works
- [ ] API routes require authentication
- [ ] API routes validate organization
- [ ] No linting errors

## Next Steps

After testing:
1. Fix any issues found
2. Update documentation if needed
3. Deploy to production
4. Monitor logs for errors
5. Gather user feedback

---

**Last Updated**: 2026-04-05
**Status**: Ready for testing
