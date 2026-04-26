# Employee Performance & Task Tracking System

A comprehensive multi-tenant cloud-based employee performance and task tracking system built with Next.js 15, Supabase, and shadcn/ui.

## Overview

This enterprise-grade system provides complete employee performance tracking with role-based access control, timezone-aware attendance, real-time notifications, and sophisticated approval workflows. Perfect for organizations of any size looking to streamline employee management and boost productivity.

## Latest Updates (v2.0)

**New Task Management Features** - See `../WHATS_NEW.md` for details:
- Tabular task display with expandable rows
- Numeric task support with auto-calculated monthly totals
- Submission timestamps (HH:MM DD/MM/YYYY format)
- Manager review interface with approve/reject
- Monthly summary cards for numeric tasks

**Action Required**: Run database migration - See `../MIGRATION_INSTRUCTIONS.md`

## Key Features

### Core Functionality
- **Multi-Tenant Architecture**: Complete data isolation with path-based routing
- **Role-Based Access Control**: Admin, Manager, and Employee roles with hierarchical permissions
- **Task Management**: Daily, Weekly, and Monthly task tracking with verification workflows
- **Timezone-Aware Attendance**: Intelligent clock-in/out with automatic timezone detection
- **Leave Management**: Comprehensive leave request and approval system
- **Real-Time Notifications**: Live updates for all important events
- **Performance Leaderboard**: Monthly rankings with historical tracking
- **Mistake Tracking**: Quality assurance and improvement tracking
- **Calendar View**: Month view combining approved leaves, attendance, and per-day task status ([`CALENDAR_FEATURE.md`](CALENDAR_FEATURE.md))
- **Manager Dashboard**: Centralized approval hub for all pending requests

### Technical Highlights
- **Secure by Default**: Row Level Security (RLS) policies on all tables
- **Real-Time Updates**: Supabase Realtime for instant notifications
- **Timezone Intelligence**: Accurate time handling across all timezones
- **Scalable Architecture**: Built to handle organizations of any size
- **Modern UI**: Clean, responsive design with shadcn/ui components
- **Type-Safe**: Full TypeScript implementation

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Realtime)
- **Deployment**: Vercel
- **Authentication**: Supabase Auth with JWT
- **Database**: PostgreSQL with Row Level Security
- **Real-Time**: WebSocket subscriptions via Supabase

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- A Supabase account
- Git (optional)

### Installation

1. **Clone or download the project**
   ```bash
   cd employee-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at https://supabase.com
   - Copy your project URL and keys
   - Run the migrations in `supabase/migrations/`

4. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

For detailed setup instructions, see [SETUP.md](SETUP.md).

## Documentation

- **[SETUP.md](SETUP.md)** - Complete setup guide with step-by-step instructions
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide for Vercel
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Comprehensive project overview and architecture
- **[CALENDAR_FEATURE.md](CALENDAR_FEATURE.md)** - Calendar page: leaves, attendance, tasks, queries, and rules
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions

## Project Structure

```
employee-tracker/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication pages
│   ├── org/[orgSlug]/       # Organization-scoped pages
│   └── api/                 # API routes
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── shared/              # Shared components
│   └── tasks/               # Task-specific components
├── lib/                     # Utilities and helpers
│   ├── supabase/           # Supabase client configuration
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   └── types/              # TypeScript type definitions
├── supabase/               # Database
│   ├── migrations/         # SQL migrations
│   └── seed.sql           # Sample data
└── middleware.ts           # Next.js middleware for auth
```

## Core Features

### 1. Authentication & Authorization
- Secure login and signup
- Organization creation during signup
- Role-based access control
- Protected routes with middleware

### 2. Dashboard
- Personalized view based on role
- Today's tasks summary
- Attendance status
- Quick actions
- Performance metrics

### 3. Task Management
- Create and assign tasks (Daily/Weekly/Monthly)
- Submit tasks with comments/reasons
- Manager verification workflow
- Status tracking (pending, approved, rejected)

### 4. Attendance System
- Timezone-aware clock-in/out
- 9:15 AM cutoff with late request workflow
- Manager approval for late clock-ins
- Attendance history
- Clock-out validation

### 5. Leave Management
- Request leaves with date ranges
- Full day and half day options
- Manager approval workflow
- Leave calendar view
- Status tracking

### 6. Notifications
- Real-time notification bell
- Multiple notification types
- Mark as read/unread
- Notification history
- Deep links to relevant pages

### 7. Manager Panel
- Team member overview
- Pending approvals dashboard
- **Tasks** (sidebar: Regular, Shared, History): due-today view, numeric shared rollup, full task log history; **approvals** on **Tasks → Regular** (pending rows). See [`MANAGER_TASKS_TAB.md`](MANAGER_TASKS_TAB.md). Disclosure accordions (chevron): [`ACCORDION_DETAILS_CHEVRON.md`](ACCORDION_DETAILS_CHEVRON.md).
- Attendance approval
- Leave approval
- Bulk actions

### 8. Leaderboard
- Monthly performance rankings
- Top 3 performers with badges
- Historical data
- Manager-assigned scores

### 9. Mistake Tracking
- Log mistakes by severity
- Employee view of mistakes
- Trend analysis
- Quality improvement tracking

### 10. Calendar View
- Approved leaves (cross-month ranges); leave days show only leave
- Clock-in / clock-out with green and red rules (cutoff, 17:00, incomplete tasks)
- Task stripes: incomplete (red) and manager-approved completed (green); hover for task names and type badges
- Month navigation, today highlight, legend
- Details: [`CALENDAR_FEATURE.md`](CALENDAR_FEATURE.md)

### 11. Admin Panel
- User management
- Organization settings
- Role assignment
- Feature toggles

## Database Schema

The system uses 10 core tables with comprehensive Row Level Security:

- **organizations** - Tenant/organization data
- **users** - User profiles with roles and hierarchy
- **tasks** - Task definitions
- **task_logs** - Task submissions and verifications
- **attendance** - Clock-in/out records
- **leaves** - Leave requests
- **notifications** - Real-time notifications
- **leaderboard** - Performance rankings
- **mistakes** - Quality tracking
- **audit_logs** - System audit trail

All tables include RLS policies ensuring complete data isolation between organizations.

## Security

- Row Level Security (RLS) on all tables
- JWT-based authentication
- Tenant isolation at database level
- Secure environment variable handling
- HTTPS-only in production
- Input validation and sanitization

## Deployment

The application is optimized for deployment on Vercel:

1. Push to GitHub
2. Import to Vercel
3. Configure environment variables
4. Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

This is a complete implementation based on the specification. For modifications:

1. Review the code structure
2. Understand the RLS policies
3. Test changes thoroughly
4. Ensure multi-tenant isolation

## License

MIT

## Support

For questions or issues:
- Review the documentation files
- Check Supabase docs: https://supabase.com/docs
- Check Next.js docs: https://nextjs.org/docs

## Acknowledgments

- Next.js team for the amazing framework
- Supabase for the backend infrastructure
- shadcn for the beautiful UI components
- Radix UI for accessible primitives

---

**Built with Next.js 15, Supabase, and shadcn/ui**
