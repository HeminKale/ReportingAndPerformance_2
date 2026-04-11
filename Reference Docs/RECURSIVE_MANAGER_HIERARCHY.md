# Recursive manager hierarchy

## Status

Implementation is complete when both of the following are true:

1. **Database:** The function `get_all_subordinates(manager_uuid UUID)` exists in Supabase (you have run the migration / SQL).
2. **App:** The manager panel loads the team via `supabase.rpc('get_all_subordinates', { manager_uuid: authUser.id })` in `app/org/[orgSlug]/manager/page.tsx`.

With that, a manager sees **all descendants** in the chain (direct reports and their reports, at any depth), not only one level.

## Behavior

- **Before:** Team was `users` where `manager_id = current user` (single level).
- **After:** Team is everyone reachable by following `manager_id` downward from the current user.

Example: Manager A manages Manager B; B manages employees C, D, E. After this change, A’s manager panel includes B, C, D, and E for task logs, attendance, leaves, mistakes, team list, and task assignment assignees (anything keyed off `teamIds` / `teamMembers`).

## Database function

The function is defined in the repo at `supabase/migrations/user_hierarchy` and should match what is deployed in Supabase:

- Recursive CTE starting from `users.manager_id = manager_uuid`.
- Returns: `id`, `full_name`, `role`, `manager_id`, `depth`.
- `SECURITY DEFINER` so the function can read the full subtree even when row-level security on `users` would otherwise hide non-direct reports.

If you need to re-apply manually, run the contents of `supabase/migrations/user_hierarchy` in the Supabase SQL Editor.

## Application code

Only the manager panel team fetch was changed to use RPC; downstream queries already filter with `.in('user_id', teamIds)`, so they automatically cover the expanded team.

## Verifying in Supabase

Replace `<manager_id>` with the UUID of the top manager:

```sql
SELECT * FROM get_all_subordinates('<manager_id>'::uuid);
```

You should see every user in their subtree, with `depth` increasing by level.
