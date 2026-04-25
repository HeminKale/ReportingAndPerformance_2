# Project Overview

You are suppose to change the UI/UX, graphics, icons and stylling and CSS ONLY.
Do not touch the fucntionality, if any doubt ask before procedding further

You are an expert UI/UX developer and Next.js + Tailwind CSS engineer. Your task is to build a highly engaging, gamified Employee Task & Reporting Application. The app is designed to make daily operations, task tracking, and manager approvals feel rewarding and enthusiastic, avoiding the boring SaaS look.

# Tech Stack & Setup 
- Framework: Next.js 14+ (App Router)
- Language: TypeScript
- Styling: Tailwind CSS (v3 or v4)
- Icons: `lucide-react`
- Charts (if needed): `recharts`
- Animations: `framer-motion` (or `motion/react`)

# Global Design System & CSS Rules

## 1. Typography
- Primary Font: `Inter`
- Secondary/Monospace Font: `JetBrains Mono` (for XP points, stats, and badges)
- Headings should use `tracking-tight` and `font-bold` to `font-black`.
- Small labels should use `uppercase tracking-wider text-xs font-bold`.

## 2. Color Palette & Theming (Tailwind Classes)
- **Backgrounds**: Use `bg-slate-50` for the app background. Use `bg-white` for cards and content panels.
- **Borders**: Soft borders using `border-slate-200`.
- **Text**: `text-slate-900` for primary text, `text-slate-500` for secondary text.
- **Primary Accents**: `blue-600` and `indigo-600` for primary actions and active states.
- **Gamification Colors**: 
  - XP Points/Level-ups: `text-fuchsia-500` or `bg-gradient-to-r from-blue-400 via-indigo-400 to-fuchsia-400`.
  - Streaks/Fire: `text-orange-500` and `bg-orange-50`.
  - Completions/Success: `emerald-500` and `bg-emerald-50`.

## 3. Component Styling Guidelines
- **Cards**: Use `rounded-2xl` or `rounded-3xl` for major layout blocks, and `rounded-xl` for inner list items. Always include `shadow-sm` and `border border-slate-200`.
- **Hover States**: Interactive elements must have `transition-all duration-200`. Buttons should have `hover:-translate-y-0.5 hover:shadow-md`.
- **Badges**: Use pill shapes format: `px-2 py-0.5 rounded-full text-xs font-bold`.

---

# Golden Rules for Layout Content
**CRITICAL RULE: NO REDUNDANT HEADERS.** 
If a user selects a tab from navigation (e.g., "Attendance" or "Dashboard"), the page content MUST NOT repeat the name of the tab as a giant heading at the top of the view. It is structurally understood what page the user is on based on the navigation's active state. The content layout should immediately start with the actionable widgets/components.

---

# Screen Architecture & Views

## 1. Main App Shell (Top Navigation Layout)
- Implement a clean, minimal Top Navigation Bar positioned `fixed top-0 w-full z-50`.
- **Left side**: App Logo / Name.
- **Center**: Navigation Links (Dashboard, Tasks, Manager Panel, etc.). The active link should have a subtle background (e.g., `bg-slate-100 text-slate-900 font-bold`).
- **Right side**: Notification Bell and User Profile Avatar.
-**ON click of Avatar**: Show name, Role (manager, Admin, Employee), Streaks Symobol and count, XP and count, Logout options one below the other
- **Constraint**: DO NOT put the user's level, XP, or streak in this top app shell. Keep it strictly for navigation. Gamified stats belong exclusively in the body of the Dashboard tab.

## 2. Dashboard View (Gamified Layout)
*Context: The primary landing view.*
- **Hero Card (Top Full Width)**: A dark, gorgeous gradient card (`from-indigo-900 to-indigo-800 text-white rounded-3xl p-8`). 
  - Show "Welcome back, Hero! Ready to crush another day?"
  - Show an elaborate progress bar for "XP to next Level".
  - Include floating/glowing UI elements like a Rank Badge (e.g., "Focus Master Lvl 4").
  - On the side of this hero card, show two mini blocks: "Day Streak (Flame icon)" and "Completion Rate".
- **Middle Section**: A "Clock-In" action area showing tasks pending for the day, prompting the user enthusiastically to start their shift.
- **Bottom Section (Daily Quests)**: A grid of 3 cards representing daily goals (e.g., "Zero Mistakes Today", "Clear 5 High Priority Tasks"). Each displays exactly how much "+XP" they offer.
-**Show Gear Icon**: Show Gear icon beside the Avatar only for roles = Manager and Admin.
on click of Gear Icon open new window with only 2 tabs: Manager Panel, Admin
Remove Manager Panel from current location and it should now be accesible via gear icon.

## 3. Tasks View (Split View Layout)
*Context: Where employees manage their workflow.*
- **Overall Layout**: Use a standard `flex flex-row gap-6` filling the height of the screen.
- **Left Panel (Sidebar)**: 
  - Vertical list of categories: "Daily", "Weekly", "Monthly".
  - Each item shows a pill with the count of tasks.
  - At the bottom of this sidebar, place a prominent "Add Task" button (`bg-slate-900 text-white w-full rounded-xl`).
- **Right Main Area**:
  - **Top Bar**:
    - Left side: A segmented control toggle for "Current" vs "History" tasks. 
    - Right side: A segmented control toggle switching between "List View" (table layout) and "Board View" (Kanban layout).
  - **Content Below**: 
    - If "List View" is selected: Render a clean table (Status Checkbox, Task Name, Priority Badge, Reward XP).
    - If "Board View" is selected: Render a Kanban board with 4 columns: "To Do", "In Progress", "Completed", "Approved".
    - If "History" is selected inside either mode: Show previously completed tasks which is done currently.
## 4. Manager Panel (Side Nav Panel)
*Context: Where managers approve tasks and view team reports.*
-**Manager Panel access and location**: Manager Panel now shall be accessible from the gear icon.
- **Overall Layout**: A dual-pane layout (`flex flex-row gap-6`).
- **Left Sidebar Navigation**:
  - Render a vertical list of menu items: Today's Tasks, Task Verifications, Attendance, Attendance Report, Track Mistakes, Leaves, Team Members, Task Assignment.
  - Active state: `bg-slate-900 text-white rounded-xl shadow-md`. Inactive state: `text-slate-600 hover:bg-slate-50`.
  - Include notification badges on items that need attention (e.g., "Task Verifications" gets a red/amber pill with a count of `12`).
- **Right Content Area**:
  - Displays the content based on the left sidebar selection.
  - Remember the Golden Rule: Do NOT write "Task Verifications" as a giant header again inside this pane. Let the list of requests start immediately.
  - **List Design (e.g., for Task Verifications)**: White cards displaying the employee name, the specific request, and two buttons on the right: "Needs Review" (outline) and "Approve + XP" (solid, green or dark slate, styled nicely to indicate giving a reward).

# Development Instructions
1. Initialize the layout structure first (The chosen App Shell).
2. Inside the main content area, implement a state-driven approach to switch between the tabs (Dashboard, Tasks, Manager).
3. Build the Dashboard, Tasks, and Manager components exactly matching the layouts described.
4. Ensure all flex containers handle overflow correctly (e.g., `overflow-y-auto` taking up the remaining height under the top nav).
5. Add subtle Framer Motion page transitions (`initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}`) when clicking between major tabs or side-panel tabs.