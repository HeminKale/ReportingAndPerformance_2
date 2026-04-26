# Deployment Guide

## Production Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] RLS policies tested with different user roles
- [ ] Sample data created for testing
- [ ] Build succeeds locally (`npm run build`)
- [ ] No console errors in production build

### Vercel Deployment

#### Step 1: Prepare Repository

```bash
git init
git add .
git commit -m "Initial commit: Employee Performance Tracker"
git branch -M main
git remote add origin your-repo-url
git push -u origin main
```

#### Step 2: Deploy to Vercel

1. Go to https://vercel.com
2. Click "Add New" > "Project"
3. Import your Git repository
4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: .next

#### Step 3: Environment Variables

Add these in Vercel Project Settings > Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
CRON_SECRET=<generate e.g. openssl rand -hex 32; required for /api/cron/periodic-tasks and used by Vercel Cron>
```

Make sure to add them for all environments (Production, Preview, Development).

#### Periodic tasks (manager templates → employee `tasks`)

- **`vercel.json`** in the app root registers a **production** cron hitting `/api/cron/periodic-tasks`. On **Vercel Hobby**, only **once-per-day** schedules are allowed (see file for the cron expression).
- **`CRON_SECRET`** must match in Vercel env and in whatever calls the route manually; Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` ([securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)).
- **`SUPABASE_SERVICE_ROLE_KEY`** is also required for **`POST /api/manager/periodic-tasks/materialize`** (instant assign after creating an enabled periodic template).

**If Deployment Protection (SSO / password) is on:** requests can be blocked at Vercel’s edge before your API runs. Then either:

1. Enable **[Protection bypass for automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)** in the project (add a secret; Vercel may set **`VERCEL_AUTOMATION_BYPASS_SECRET`** on deployments). For **manual `curl`**, send **both** headers:
   - `x-vercel-protection-bypass: <same secret>`
   - `Authorization: Bearer <CRON_SECRET>`
2. Use **`vercel curl`** ([CLI](https://vercel.com/docs/cli/curl)) while authenticated.
3. Or do not protect **production** (simplest; weakest).

Full reference: [PERIODIC_TASKS_ARCHITECTURE.md](PERIODIC_TASKS_ARCHITECTURE.md).

**Self-hosted VPS (e.g. Hostinger):** `vercel.json` cron entries do not run there. Use Linux `cron` + `curl` as in [PERIODIC_TASKS_CRON_HOSTINGER_VPS.md](PERIODIC_TASKS_CRON_HOSTINGER_VPS.md).

#### Step 4: Deploy

Click "Deploy" and wait for the build to complete.

### Post-Deployment

1. **Test Authentication**
   - Sign up with a new account
   - Log in with existing account
   - Test password reset (if configured)

2. **Test Core Features**
   - Clock in/out
   - Task submission
   - Leave requests
   - Manager approvals
   - Notifications

3. **Performance Check**
   - Run Lighthouse audit
   - Check page load times
   - Verify real-time updates work

4. **Security Audit**
   - Test RLS policies with different roles
   - Verify no sensitive data in client
   - Check CORS settings

## Custom Domain Setup

### Step 1: Add Domain in Vercel

1. Go to Project Settings > Domains
2. Add your domain (e.g., `tracker.yourcompany.com`)
3. Note the DNS records provided

### Step 2: Configure DNS

Add these records to your DNS provider:

```
Type: A
Name: tracker (or @)
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### Step 3: Wait for Propagation

DNS changes can take up to 48 hours, but usually complete within a few hours.

### Step 4: Enable SSL

Vercel automatically provisions SSL certificates via Let's Encrypt.

## Environment-Specific Configuration

### Production

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
```

### Staging

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_staging_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_staging_service_role_key
```

## Database Backup Strategy

### Automated Backups (Supabase Pro)

1. Go to Supabase Dashboard > Settings > Database
2. Enable automatic backups
3. Configure retention period

### Manual Backups

```bash
# Using Supabase CLI
supabase db dump -f backup.sql

# Restore
supabase db reset --db-url your_database_url
psql -f backup.sql
```

## Monitoring and Analytics

### Vercel Analytics

1. Go to Project Settings > Analytics
2. Enable Vercel Analytics
3. View real-time and historical data

### Supabase Monitoring

1. Go to Supabase Dashboard > Reports
2. Monitor:
   - API requests
   - Database performance
   - Auth events
   - Storage usage

### Error Tracking (Optional)

Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- PostHog for product analytics

## Performance Optimization

### Image Optimization

All images should use Next.js Image component:

```tsx
import Image from 'next/image';

<Image src="/logo.png" alt="Logo" width={200} height={50} />
```

### Database Indexes

Ensure these indexes exist (already in migrations):

```sql
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_task_logs_user_date ON task_logs(user_id, date);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);
```

### Caching Strategy

- Static pages: Cached at CDN
- Dynamic pages: ISR (Incremental Static Regeneration)
- API routes: Cache with proper headers

## Security Hardening

### Rate Limiting

Implement rate limiting for sensitive endpoints:

```typescript
// middleware.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

### CORS Configuration

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'your-domain.com' },
        ],
      },
    ];
  },
};
```

### Content Security Policy

Add CSP headers in `next.config.js`:

```javascript
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co;
  frame-ancestors 'none';
`;
```

## Scaling Considerations

### Database Scaling

1. **Connection Pooling**: Supabase includes pgBouncer
2. **Read Replicas**: Available on Pro plan
3. **Indexes**: Monitor slow queries and add indexes

### Application Scaling

1. **Vercel Auto-scaling**: Handles traffic automatically
2. **Edge Functions**: Use for global low-latency
3. **Caching**: Implement Redis for session data

### Cost Optimization

1. **Supabase**: Monitor database size and API requests
2. **Vercel**: Track bandwidth and function invocations
3. **Optimize Images**: Use WebP format, proper sizing

## Rollback Procedure

If deployment fails or has issues:

1. **Instant Rollback in Vercel**:
   - Go to Deployments
   - Find last working deployment
   - Click "..." > "Promote to Production"

2. **Database Rollback**:
   - Restore from backup
   - Run rollback migrations if needed

3. **Notify Users**:
   - Post status update
   - Communicate ETA for fix

## Maintenance Windows

Schedule maintenance during low-traffic periods:

1. Announce maintenance 24-48 hours in advance
2. Set up maintenance page
3. Perform updates
4. Run smoke tests
5. Monitor for issues

## Support and Monitoring

### Health Checks

Create a health check endpoint:

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

### Uptime Monitoring

Use services like:
- UptimeRobot
- Pingdom
- StatusPage.io

### Incident Response

1. Detect issue via monitoring
2. Assess severity
3. Communicate with users
4. Fix or rollback
5. Post-mortem analysis

## Conclusion

Your Employee Performance Tracker is now production-ready! Follow this guide for smooth deployments and reliable operations.

For questions or issues, refer to:
- Vercel Documentation: https://vercel.com/docs
- Supabase Documentation: https://supabase.com/docs
- Next.js Documentation: https://nextjs.org/docs
