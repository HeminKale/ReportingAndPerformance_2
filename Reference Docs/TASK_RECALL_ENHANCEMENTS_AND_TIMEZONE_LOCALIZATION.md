# Task Recall Enhancements and Timezone Localization

This document describes the enhancements made to the **Task Recall** system and the implementation of **User-Specific Timezone Localization** for greetings and dashboard data.

## 1. Task Recall Enhancements

### Context and Reason
Initially, the "Recall" feature was restricted to today's tasks in the "Regular" view. However, managers often need to re-open tasks from previous days that were approved or rejected by mistake. Additionally, recalled tasks should be treated as "Incomplete" on the employee's dashboard until they are resubmitted.

### Functional Changes
- **History View Recall**: Managers can now recall tasks directly from the **Tasks >> History** sub-tab. The recall option is located within a three-dot menu (`MoreVertical`) for each approved or rejected log.
- **Active Task Persistence**: Any task marked as `recalled` (even from past dates) will now appear in the manager's **Regular** task list until it is resubmitted. This ensures managers can track outstanding corrections.
- **Progress Ring Integration**: 
    - Recalled tasks from any date are now included in the employee's **Task Progress Rings**.
    - **Ring 1 (Completed / Total)**: Recalled tasks are counted in the total but excluded from "Completed," causing the percentage to drop.
    - **Ring 2 (Approved / Submitted)**: Recalled tasks are counted as "Submitted" but excluded from "Approved," ensuring the approval rate accurately reflects that a previous submission was revoked.

### Code References
- `app/org/[orgSlug]/manager/page.tsx`: Updated `todayTaskRows` to include past recalled logs; added three-dot menu to history rows.
- `app/org/[orgSlug]/tasks/page.tsx`: Updated `pieChartTasks` filter to include past recalled tasks.
- `components/tasks/task-progress-rings.tsx`: Updated statistics calculation to include `recalled` in the `submitted` count.

---

## 2. User-Specific Timezone Localization

### Context and Reason
The application previously defaulted to **Indian Standard Time (IST)** for greetings and "today's" task views. For users outside of India, this caused greetings (e.g., "Good Morning") to be incorrect and "Today's Tasks" to show the wrong day's work due to UTC/IST offsets.

### Functional Changes
- **Personalized Greetings**: The dashboard greeting (Good Morning, Good Afternoon, etc.) is now determined by the hour in the user's preferred timezone (stored in the `timezone` column of the `users` table).
- **Zoned Date Calculation**: The definition of "Today" is now calculated per user. This affects:
    - **Dashboard**: Which tasks and quests are considered "for today."
    - **Attendance**: Clock-in/out logic and history range defaults.
    - **Manager Panel**: Filtering of today's team activities.
    - **Tasks Page**: Default view for daily/weekly/monthly tasks.
    - **Leaderboard**: Initial month and day selections.
- **Database-to-Local Conversion**: Formatting functions (like `toDayString`) now explicitly convert UTC timestamps from the database into the user's target timezone before displaying the date.

### Fallback Logic
If a user does not have a timezone set in their profile, the system falls back to **Asia/Kolkata (IST)** as the default organizational standard.

### Code References
- `lib/utils/timezone.ts`: Core utility used for zoned date creation.
- `app/org/[orgSlug]/dashboard/page.tsx`: Server-side timezone fetch and greeting logic.
- `app/org/[orgSlug]/attendance/page.tsx`, `manager/page.tsx`, `tasks/page.tsx`, `leaderboard/page.tsx`: Client-side refactoring to fetch user timezone before defining "today."
