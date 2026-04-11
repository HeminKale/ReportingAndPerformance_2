# Daily and monthly employee ratings

## Summary

The app supports two separate rating flows:

- **Monthly** (existing): Numeric scores (1–10), ranks, and optional notes stored in `leaderboard`. Shown on **Leaderboard → Monthly** with a month picker. Entered under **Settings → Employee Ratings → Monthly**.

- **Daily** (new): Categorical performance and optional comments per calendar day, stored in `leaderboard_daily`. Shown on **Leaderboard → Daily** with a calendar. Entered under **Settings → Employee Ratings → Daily**.

Admins are excluded from both rating lists (only managers and employees appear as ratees). Admins can still publish ratings from Settings.

## Database

**Migration file**: `supabase/migrations/20260411000000_leaderboard_daily.sql`

**Enum** `daily_performance_rating`:

| Stored value   | UI label   |
|----------------|------------|
| `very_poor`    | Very poor  |
| `poor`         | Poor       |
| `average`      | Average    |
| `good`         | Good       |
| `very_good`    | Very Good  |
| `excellent`    | Excellent  |

**Table** `leaderboard_daily`:

- `organization_id`, `user_id`, `rating_date` (DATE), `performance`, `comments` (nullable), `decided_by`, timestamps.
- **Unique constraint**: `(organization_id, user_id, rating_date)` — used for Supabase `upsert` with `onConflict: 'organization_id,user_id,rating_date'`.
- **Index**: `(organization_id, rating_date)` for listing by day.

**Row Level Security** (same idea as `leaderboard`):

- **SELECT**: `organization_id = get_user_org()`.
- **INSERT / UPDATE**: `organization_id = get_user_org() AND is_manager()` (admins and managers).

Apply the migration with `supabase db push` or by running the SQL in the Supabase SQL editor.

## TypeScript

**File**: `lib/types/database.ts`

- `DailyPerformanceRating` — union of the six enum string values.
- `LeaderboardDaily` — row shape for `leaderboard_daily`.
- `DAILY_PERFORMANCE_OPTIONS` — `{ value, label }[]` for selects and display.
- `dailyPerformanceLabel()` — maps a stored value to the human-readable label.

## UI components

**Files**:

- `components/ui/popover.tsx` — Radix Popover wrapper for the date picker shell.
- `components/ui/calendar.tsx` — `react-day-picker` (v8) styled for Tailwind / shadcn-style usage.

## Leaderboard page

**File**: `app/org/[orgSlug]/leaderboard/page.tsx`

- **Tabs**: Monthly | Daily.
- **Monthly**: Unchanged behavior (month input, ranked cards, employee of the month hero when data exists).
- **Daily**:
  - Default selected date: today (browser local calendar date).
  - Calendar in a popover; choosing a day refetches data.
  - Loads all org users with `role != 'admin'`, merges with `leaderboard_daily` for `rating_date`.
  - Table columns: **Employee**, **Performance**, **Comments** (dashes when no row for that user/date).
  - Helper text when no ratings exist for the selected date but employees are listed.

## Settings page

**File**: `app/org/[orgSlug]/settings/page.tsx`

- **Employee Ratings** card contains inner tabs: **Monthly** | **Daily**.
- **Monthly**: Month picker, score 1–10, notes, **Publish monthly ratings** → `leaderboard` upsert (unchanged logic).
- **Daily**: Date picker (calendar popover), per-employee performance `Select` (six levels or blank), comments `Input`, **Publish daily ratings** → `leaderboard_daily` upsert for rows where a performance level is selected (blank rows are skipped).

## Smoke test

1. Apply `20260411000000_leaderboard_daily.sql` to the project database.
2. As admin: **Settings → Employee Ratings → Daily**, pick today, set performance for at least one employee, publish.
3. As any org user: **Leaderboard → Daily**, confirm today shows the published values; change the calendar date and confirm the table updates.

## Not implemented (by design)

- Clearing a published daily rating from the UI (would require delete or an explicit “clear” workflow).
- Organisation-timezone-based “today”; the UI uses the client’s local date for defaults and calendar selection.
