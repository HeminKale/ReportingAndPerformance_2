# Employee Performance Tracker - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- A Supabase account (https://supabase.com)
- Git (optional)

## Step 1: Supabase Setup

### 1.1 Create a New Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in your project details:
   - Name: employee-tracker
   - Database Password: (save this securely)
   - Region: Choose closest to your users
4. Wait for the project to be created

### 1.2 Get Your Supabase Credentials

1. Go to Project Settings > API
2. Copy the following:
   - Project URL (NEXT_PUBLIC_SUPABASE_URL)
   - anon/public key (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - service_role key (SUPABASE_SERVICE_ROLE_KEY) - Keep this secret!

### 1.3 Run Database Migrations

1. Go to the SQL Editor in your Supabase dashboard
2. Open `supabase/migrations/20240101000000_initial_schema.sql`
3. Copy and paste the entire content
4. Click "Run" to execute
5. Repeat for `supabase/migrations/20240101000001_rls_policies.sql`

### 1.4 Enable Realtime (Optional but Recommended)

1. Go to Database > Replication
2. Enable replication for the `notifications` table
3. This allows real-time notification updates

## Step 2: Project Setup

### 2.1 Install Dependencies

```bash
cd employee-tracker
npm install
```

### 2.2 Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Replace the values with your actual Supabase credentials from Step 1.2.

## Step 3: Create Your First Organization

### 3.1 Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 3.2 Sign Up

1. Click "Sign up" on the login page
2. Fill in your details:
   - Full Name: Your name
   - Email: Your email
   - Password: Choose a secure password
   - Organization Name: Your company name
   - Organization Slug: URL-friendly name (e.g., "acme-corp")
3. Click "Create Account"

You'll be automatically logged in as an admin user!

## Step 4: Add Users

### Option A: Through the Admin Panel (Recommended for Testing)

1. Go to Admin Panel
2. Note: The "Add User" button is for demonstration
3. For actual user creation, use Option B

### Option B: Manual User Creation (Production)

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User"
3. Enter email and password
4. After creating the auth user, go to SQL Editor and run:

```sql
INSERT INTO users (id, organization_id, email, full_name, role, timezone)
VALUES (
  'auth-user-id-from-supabase',
  'your-organization-id',
  'user@example.com',
  'User Full Name',
  'employee',
  'America/New_York'
);
```

Replace the values with actual data.

## Step 5: Configure Manager Hierarchy

To set up manager-employee relationships:

```sql
UPDATE users
SET manager_id = 'manager-user-id'
WHERE id = 'employee-user-id';
```

## Step 6: Create Sample Tasks

As an admin or manager, you can create tasks through the Manager Panel or directly in SQL:

```sql
INSERT INTO tasks (organization_id, title, description, type, assigned_by, is_common_task)
VALUES (
  'your-organization-id',
  'Daily Standup Update',
  'Post your daily standup in the team channel',
  'daily',
  'your-user-id',
  true
);
```

## Step 7: Testing the System

### Test Employee Flow

1. Log in as an employee
2. Clock in (before 9:15 AM for normal, after for late request)
3. Submit daily tasks with comments
4. Request a leave

### Test Manager Flow

1. Log in as a manager
2. Go to Manager Panel
3. Approve/reject pending items:
   - Task verifications
   - Late clock-in requests
   - Leave requests

### Test Admin Flow

1. Log in as an admin
2. Access Admin Panel
3. View all users
4. Check organization settings

## Step 8: Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables:
   - Add all three Supabase keys
6. Click "Deploy"

Your app will be live at `your-app.vercel.app`!

### Custom Domain (Optional)

1. Go to Project Settings > Domains in Vercel
2. Add your custom domain
3. Follow the DNS configuration instructions

## Troubleshooting

### Issue: "Organization not found" after signup

**Solution**: Check that the organization was created in the database. Run:

```sql
SELECT * FROM organizations WHERE slug = 'your-slug';
```

### Issue: RLS policies blocking access

**Solution**: Verify the user exists in the users table and has the correct organization_id:

```sql
SELECT * FROM users WHERE email = 'your-email';
```

### Issue: Notifications not updating in real-time

**Solution**: 
1. Check that Realtime is enabled for the notifications table
2. Verify your browser allows WebSocket connections

### Issue: Clock-in time validation not working

**Solution**: Ensure the user's timezone is set correctly in the users table.

## Security Best Practices

1. **Never commit `.env.local`** - It's in `.gitignore` by default
2. **Keep service_role key secret** - Only use it server-side
3. **Review RLS policies** - Test with different user roles
4. **Enable 2FA** - For admin accounts in production
5. **Regular backups** - Set up automated Supabase backups

## Next Steps

1. Customize the organization settings
2. Add more task types as needed
3. Configure email notifications (Supabase Auth settings)
4. Set up analytics (optional)
5. Add custom branding (logo, colors)

## Support

For issues or questions:
- Check the Supabase documentation: https://supabase.com/docs
- Review Next.js App Router docs: https://nextjs.org/docs
- Check the database schema in `supabase/migrations/`

## License

MIT
