# Next Steps - Deployment Guide

## ✅ Completed Steps

1. **Supabase Migration** - Database schema and RLS policies deployed
2. **Environment Variables** - `.env.local` configured with Supabase credentials
3. **GitHub Repository** - Code pushed to https://github.com/HeminKale/ReportingAndPerformance/tree/initialsetup

---

## 🚀 What's Next?

### Step 1: Deploy to Vercel (Recommended)

#### Option A: Deploy via Vercel Dashboard

1. **Go to Vercel**
   - Visit https://vercel.com
   - Sign in with your GitHub account

2. **Import Project**
   - Click "Add New" → "Project"
   - Select your repository: `HeminKale/ReportingAndPerformance`
   - Select branch: `initialsetup`

3. **Configure Project**
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

4. **Add Environment Variables**
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   
   Make sure to add them for:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Your app will be live at: `https://your-project.vercel.app`

#### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
cd /Users/hemin.kale/Desktop/employee-tracker
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? employee-tracker
# - Directory? ./
# - Override settings? No

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy to production
vercel --prod
```

---

### Step 2: Create Your First Organization

Once deployed, visit your app and:

1. **Sign Up**
   - Go to `/signup`
   - Enter your details:
     - Full Name
     - Email
     - Password
     - Organization Name (e.g., "Acme Corporation")
     - Organization Slug (e.g., "acme-corp")
   - Click "Create Account"

2. **You're automatically logged in as Admin!**
   - You'll be redirected to `/org/acme-corp/dashboard`

---

### Step 3: Add Users to Your Organization

#### Option A: Through Supabase Dashboard (Recommended for now)

1. **Create Auth User**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Enter email and password
   - Copy the User ID (UUID)

2. **Add to Users Table**
   - Go to Table Editor → `users` table
   - Click "Insert" → "Insert row"
   - Fill in:
     ```
     id: [paste the auth user UUID]
     organization_id: [your organization UUID from organizations table]
     email: user@example.com
     full_name: John Doe
     role: employee (or manager)
     manager_id: [optional - your admin UUID if this is an employee]
     timezone: America/New_York
     ```
   - Click "Save"

3. **User can now login**
   - They can login with their email/password
   - They'll see their role-appropriate dashboard

#### Option B: SQL Script (Bulk Add)

Run this in Supabase SQL Editor:

```sql
-- First, create auth users in Supabase Auth UI, then run this:

-- Add Manager
INSERT INTO users (id, organization_id, email, full_name, role, timezone)
VALUES (
  'auth-user-uuid-here',
  'your-org-uuid-here',
  'manager@company.com',
  'Jane Manager',
  'manager',
  'America/New_York'
);

-- Add Employee reporting to Manager
INSERT INTO users (id, organization_id, email, full_name, role, manager_id, timezone)
VALUES (
  'auth-user-uuid-here',
  'your-org-uuid-here',
  'employee@company.com',
  'John Employee',
  'employee',
  'manager-uuid-here',
  'America/New_York'
);
```

---

### Step 4: Create Sample Tasks

As an Admin or Manager, create some tasks:

```sql
-- Run in Supabase SQL Editor

-- Daily Task (Common to all employees)
INSERT INTO tasks (organization_id, title, description, type, assigned_by, is_common_task)
VALUES (
  'your-org-uuid',
  'Daily Standup Update',
  'Post your daily standup in the team channel',
  'daily',
  'your-admin-uuid',
  true
);

-- Weekly Task
INSERT INTO tasks (organization_id, title, description, type, day_of_week, assigned_by, is_common_task)
VALUES (
  'your-org-uuid',
  'Weekly Report',
  'Submit your weekly progress report',
  'weekly',
  5, -- Friday
  'your-admin-uuid',
  true
);

-- Monthly Task
INSERT INTO tasks (organization_id, title, description, type, due_date, assigned_by, is_common_task)
VALUES (
  'your-org-uuid',
  'Monthly Review',
  'Complete your monthly self-review',
  'monthly',
  '2026-04-30', -- Last day of month
  'your-admin-uuid',
  true
);
```

---

### Step 5: Test the System

#### As Employee:
1. **Login** with employee credentials
2. **Clock In** - Go to Attendance page
   - Before 9:15 AM: Normal clock-in
   - After 9:15 AM: Late request with reason
3. **Submit Tasks** - Go to Tasks page
   - Mark tasks as completed with comments
   - Or mark as pending with reasons
4. **Request Leave** - Go to Leaves page
   - Select dates and type
   - Submit for approval

#### As Manager:
1. **Login** with manager credentials
2. **Go to Manager Panel**
3. **Approve/Reject**:
   - Task verifications
   - Late clock-in requests
   - Leave requests
4. **View Team** - See all direct reports

#### As Admin:
1. **Login** with admin credentials
2. **Go to Admin Panel**
3. **Manage Users** - View all organization users
4. **View Settings** - Organization configuration

---

### Step 6: Configure Organization Settings

Currently, organization settings are in the database. To customize:

```sql
-- Update organization settings
UPDATE organizations
SET settings = jsonb_set(
  settings,
  '{clock_in_cutoff}',
  '"09:30"'  -- Change cutoff time
)
WHERE slug = 'your-org-slug';

-- Enable/disable features
UPDATE organizations
SET settings = jsonb_set(
  settings,
  '{features,leaderboard}',
  'false'  -- Disable leaderboard
)
WHERE slug = 'your-org-slug';
```

---

## 🎯 Quick Start Checklist

- [ ] Deploy to Vercel
- [ ] Add environment variables
- [ ] Create first organization (via signup)
- [ ] Add 2-3 test users (1 manager, 2 employees)
- [ ] Create sample tasks
- [ ] Test employee workflow (clock-in, submit tasks)
- [ ] Test manager workflow (approve requests)
- [ ] Test notifications (should appear in real-time)

---

## 🔧 Troubleshooting

### Issue: "Organization not found" after signup
**Solution**: Check the organizations table in Supabase. The organization should have been created automatically.

### Issue: Can't see tasks
**Solution**: 
1. Verify tasks exist in the `tasks` table
2. Check `is_common_task = true` or `assigned_to = your_user_id`
3. Verify `is_active = true`

### Issue: Notifications not appearing
**Solution**:
1. Check Supabase Realtime is enabled for `notifications` table
2. Go to Database → Replication → Enable for `notifications`

### Issue: Clock-in time validation not working
**Solution**: Verify user's timezone is set correctly in the `users` table

---

## 📱 Mobile Testing

The app is responsive and works on mobile devices. Test on:
- iOS Safari
- Android Chrome
- Different screen sizes

---

## 🔐 Security Checklist

- [x] RLS policies enabled on all tables
- [x] Environment variables configured
- [x] `.env.local` in `.gitignore`
- [x] Service role key kept secret (server-side only)
- [ ] Enable 2FA for admin accounts (in Supabase Auth)
- [ ] Set up Supabase backups (in Supabase Dashboard)

---

## 📊 Monitoring

### Vercel Analytics
1. Go to your Vercel project
2. Click "Analytics" tab
3. View real-time traffic and performance

### Supabase Monitoring
1. Go to Supabase Dashboard
2. Click "Reports"
3. Monitor:
   - API requests
   - Database performance
   - Auth events

---

## 🎉 You're Ready!

Your employee performance tracking system is now:
- ✅ Deployed to production
- ✅ Secured with RLS policies
- ✅ Multi-tenant ready
- ✅ Real-time enabled
- ✅ Fully functional

**Next**: Invite your team and start tracking performance!

---

## 📚 Additional Resources

- **Main Documentation**: `Reference Docs/README.md`
- **Setup Guide**: `Reference Docs/SETUP.md`
- **Deployment Guide**: `Reference Docs/DEPLOYMENT.md`
- **Project Summary**: `Reference Docs/PROJECT_SUMMARY.md`

---

## 🆘 Need Help?

1. Check the documentation files in `Reference Docs/`
2. Review Supabase logs in Dashboard
3. Check Vercel deployment logs
4. Verify environment variables are set correctly

**Your system is production-ready! 🚀**
