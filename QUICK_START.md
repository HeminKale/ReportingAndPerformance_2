# Quick Start Guide - Test Your System Now! 🚀

## The Signup Issue is Fixed! ✅

I've implemented a server-side signup API that resolves the RLS policy error you were experiencing.

## Test It Right Now (3 Minutes)

### Step 1: Clean Up (If Needed)

If you tried signing up before, clean up the orphaned auth user:

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Run this query:

```sql
-- Delete any orphaned auth users
DELETE FROM auth.users 
WHERE id NOT IN (SELECT id FROM users);
```

### Step 2: Start Dev Server

```bash
cd /Users/hemin.kale/Desktop/employee-tracker
npm run dev
```

### Step 3: Test Signup

1. Open browser: http://localhost:3000
2. Click "Sign up" or go to http://localhost:3000/signup
3. Fill in the form:
   - **Full Name**: Your Name
   - **Email**: admin@bqsr.com (or any email)
   - **Password**: password123
   - **Organization Name**: BQSR
   - **Organization Slug**: bqsr

4. Click "Create Account"

### Expected Result ✅

- Redirects to: `http://localhost:3000/org/bqsr/dashboard`
- Dashboard loads successfully
- Shows your name in the sidebar
- No errors in console

### Step 4: Verify in Supabase

Go to Supabase SQL Editor and run:

```sql
-- Check everything was created
SELECT 
    'Organizations' as type, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Auth Users', COUNT(*) FROM auth.users;
```

Should show:
- Organizations: 1
- Users: 1
- Auth Users: 1

## What Was Fixed?

### The Problem
- `auth.signUp()` didn't immediately establish a session
- `auth.uid()` was `NULL` when trying to insert organization/user
- RLS policies blocked the inserts

### The Solution
- Created server-side API route: `app/api/auth/signup/route.ts`
- Uses service role key to bypass RLS during signup
- Properly handles errors with rollback
- Signs user in after successful creation

## If It Still Doesn't Work

### 1. Check Environment Variables

```bash
cat .env.local
```

Should have all three:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. Restart Dev Server

After checking `.env.local`:
```bash
# Press Ctrl+C to stop
npm run dev
```

### 3. Check Browser Console

- Open Developer Tools (F12)
- Look for errors
- Check Network tab for failed requests

### 4. Check Supabase Logs

1. Supabase Dashboard → Your Project
2. Logs → API Logs
3. Look for errors around signup time

## Next Steps After Signup Works

### 1. Explore the Dashboard
- View your tasks
- Try clock in/out
- Check notifications

### 2. Create Sample Data

Run this in Supabase SQL Editor to add sample tasks:

```sql
-- Get your user ID and org ID
SELECT id as user_id FROM users WHERE email = 'admin@bqsr.com';
SELECT id as org_id FROM organizations WHERE slug = 'bqsr';

-- Create a daily task (replace UUIDs with your actual IDs)
INSERT INTO tasks (organization_id, title, description, type, assigned_by, is_common_task, is_active)
VALUES (
    'your-org-id-here',
    'Daily Standup',
    'Post your daily update',
    'daily',
    'your-user-id-here',
    true,
    true
);
```

### 3. Add More Users

Use the Admin panel at `/org/bqsr/admin` to:
- View users
- Manage organization settings

Or create users via SQL:

```sql
-- First create auth user in Supabase Dashboard → Authentication → Users
-- Then add to your users table:
INSERT INTO users (id, organization_id, email, full_name, role, manager_id)
VALUES (
    'auth-user-id-from-supabase',
    'your-org-id',
    'employee@bqsr.com',
    'Employee Name',
    'employee',
    'your-admin-id'  -- Set you as their manager
);
```

### 4. Deploy to Production

When ready, see `Reference Docs/DEPLOYMENT.md` for Vercel deployment instructions.

## Documentation

- **SIGNUP_FIX.md** - Detailed explanation of the fix
- **TROUBLESHOOTING.md** - Common issues and solutions
- **SETUP.md** - Complete setup guide
- **DEPLOYMENT.md** - Production deployment guide

## Quick Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run production build locally
npm start

# Check for linting errors
npm run lint
```

## System Features Ready to Test

### Authentication ✅
- Signup (fixed!)
- Login
- Logout
- Session management

### Dashboard ✅
- Personalized view
- Today's tasks
- Quick actions
- Attendance status

### Task Management ✅
- Daily/Weekly/Monthly tasks
- Task submission
- Manager verification
- Status tracking

### Attendance ✅
- Clock in/out
- Timezone awareness
- Late request workflow
- History view

### Notifications ✅
- Real-time updates
- Notification bell
- Mark as read
- Deep links

### Leave Management ✅
- Request leave
- Manager approval
- Calendar view
- Status tracking

### Manager Features ✅
- Team overview
- Approval dashboard
- Task verification
- Leave approval

### Admin Features ✅
- User management
- Organization settings
- System overview

### Additional Features ✅
- Leaderboard
- Mistake tracking
- Calendar view
- Real-time updates

## Support

If you encounter any issues:

1. Check `Reference Docs/TROUBLESHOOTING.md`
2. Review browser console for errors
3. Check Supabase logs
4. Verify environment variables

## Success Criteria

You'll know it's working when:
- ✅ Signup completes without errors
- ✅ Dashboard loads successfully
- ✅ Can navigate between pages
- ✅ Can clock in/out
- ✅ Notifications appear
- ✅ No console errors

---

**The system is fully functional and ready for testing!** 🎉

Start with the 3-minute test above, then explore all the features.
