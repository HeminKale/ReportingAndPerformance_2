# Quick Reference - Task Enhancements

## 🚀 Getting Started (3 Steps)

### 1️⃣ Run Migration
```bash
# Open Supabase Dashboard → SQL Editor
# Copy and run: supabase/migrations/20240406000000_add_task_enhancements.sql
```

### 2️⃣ Start Dev Server
```bash
npm run dev
```

### 3️⃣ Test Features
- Go to Settings → Task Assignment
- Create a numeric task
- Submit it from Tasks page
- Check monthly summary

## 📋 What's New

| Feature | Description | Location |
|---------|-------------|----------|
| **Tabular View** | Tasks in table format with expandable rows | Tasks page |
| **Numeric Tasks** | Track quantities with auto-calculated monthly totals | Settings + Tasks |
| **Timestamps** | HH:MM DD/MM/YYYY format for all submissions | Task table |
| **Manager Review** | Approve/reject interface with comments | Settings |
| **Monthly Summary** | Auto-calculated totals with daily breakdown | Tasks page |

## 🎯 Common Tasks

### Create Numeric Task (Admin)
1. Settings → Task Assignment → Create Task
2. Check "Numeric Task"
3. Enter unit (e.g., "certificates")
4. If daily: Link to monthly task
5. Save

### Submit Numeric Task (Employee)
1. Tasks page → Daily tab
2. Click expand arrow on task
3. Click Submit
4. Enter numeric value
5. Submit

### Review Task (Manager)
1. Settings → Task Assignment
2. Click expand arrow on submitted task
3. Click Review
4. Approve or Reject
5. Optional: Add comment
6. Submit

## 📊 Example Use Case

**Scenario**: Track certificates prepared daily, auto-calculate monthly total

**Setup**:
```
1. Create monthly task: "Monthly Certificates Total" (numeric, unit: "certificates")
2. Create daily task: "Certificates Prepared" (numeric, unit: "certificates", link to monthly)
```

**Daily Use**:
```
Monday: Employee enters 5 → Monthly total: 5
Tuesday: Employee enters 3 → Monthly total: 8
Wednesday: Employee enters 7 → Monthly total: 15
```

**Result**: Manager reviews monthly task showing total: 15 certificates

## 🔍 Key Components

| Component | File | Purpose |
|-----------|------|---------|
| TaskTable | `components/tasks/task-table.tsx` | Tabular display |
| TaskLogDialog | `components/tasks/task-log-dialog.tsx` | Submission form |
| ManagerReviewDialog | `components/tasks/manager-review-dialog.tsx` | Review interface |
| MonthlyNumericSummary | `components/tasks/monthly-numeric-summary.tsx` | Monthly totals |

## 🗄️ Database Changes

### New Fields
```sql
-- tasks table
is_numeric_task BOOLEAN
numeric_unit TEXT
linked_monthly_task_id UUID

-- task_logs table
submitted_at TIMESTAMPTZ
numeric_value NUMERIC
manager_review_comment TEXT
```

### New Functions
- `calculate_monthly_numeric_total()` - Calculates monthly sums
- `auto_submit_monthly_numeric_task()` - Auto-creates monthly logs

### New Trigger
- `trigger_auto_monthly_numeric` - Fires on numeric value insert/update

## 🎨 UI Changes

### Before
- Card-based task layout
- No numeric support
- No submission timestamps
- No manager review interface

### After
- Tabular task layout with expandable rows
- Numeric task support with auto-calculation
- Submission timestamps (HH:MM DD/MM/YYYY)
- Manager review interface with approve/reject

## 📱 User Roles

### Employee
- View tasks in tabular format
- Submit regular or numeric tasks
- See submission timestamps
- See manager approval status
- View monthly summary for numeric tasks

### Manager
- Review submitted tasks
- Approve/reject with comments
- See all submission details
- Send notifications to employees

### Admin
- Create numeric tasks
- Link daily to monthly tasks
- Manage all task settings
- All manager capabilities

## 🔧 Troubleshooting

### Migration fails
- Check if columns already exist
- See rollback section in MIGRATION_INSTRUCTIONS.md

### Monthly total not calculating
- Verify trigger exists
- Check daily task is linked to monthly task
- Verify numeric_value is not null

### Table not displaying
- Clear browser cache
- Check browser console for errors
- Verify tasks exist in database

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `WHATS_NEW.md` | Feature overview |
| `MIGRATION_INSTRUCTIONS.md` | Step-by-step migration |
| `IMPLEMENTATION_COMPLETE.md` | Technical summary |
| `Reference Docs/TASK_ENHANCEMENTS_COMPLETE.md` | Full documentation |

## ✅ Verification Checklist

After migration:
- [ ] Migration ran without errors
- [ ] Dev server starts
- [ ] Settings shows numeric checkbox
- [ ] Tasks page shows tabular format
- [ ] Can create numeric task
- [ ] Can submit numeric task
- [ ] Monthly total auto-calculates
- [ ] Manager can review tasks
- [ ] Timestamps display correctly

## 🎓 Training Tips

### For Employees
1. Show tabular layout
2. Demonstrate numeric task submission
3. Explain submission timestamps
4. Show manager approval status

### For Managers
1. Show review interface
2. Demonstrate approve/reject
3. Explain notification system
4. Show submission details

### For Admins
1. Show numeric task creation
2. Demonstrate task linking
3. Explain auto-calculation
4. Show all new features

## 💡 Best Practices

### Numeric Tasks
- Use clear unit labels (e.g., "certificates", not "cert")
- Link daily to monthly for auto-calculation
- Review monthly totals at end of month

### Task Submission
- Submit tasks daily for accurate timestamps
- Add meaningful comments
- Check manager approval status

### Manager Review
- Review tasks promptly
- Add constructive comments
- Use approve/reject appropriately

## 🚨 Important Notes

1. **Migration Required**: Must run migration before using new features
2. **Database Trigger**: Auto-calculation happens at database level
3. **Timestamps**: Captured automatically, no manual entry needed
4. **RLS Policies**: All existing security policies remain in place
5. **Backward Compatible**: Existing tasks work without changes

## 📞 Support

If you need help:
1. Check `TROUBLESHOOTING.md`
2. Review Supabase logs
3. Check browser console
4. Verify environment variables

---

**Version**: 2.0
**Last Updated**: April 5, 2026
**Status**: Ready to Use
