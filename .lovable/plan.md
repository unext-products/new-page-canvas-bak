# Fix app slowness (dashboard load, navigation, saves)

## What I found (verified against the live database)

The database itself is healthy — 52 MB of data, 70,632 timesheet rows, 12 of 60 connections used, memory 63%. So this is **not** a case of needing a bigger instance. The slowness comes from how timesheet queries are written and secured.

Three concrete causes, confirmed:

1. **Security rules are re-evaluated for every single row.** The access policies on `timesheet_entries` call `get_user_role(auth.uid())`, `get_user_verticals(auth.uid())` and sub-lookups per row instead of once per query. With 70k rows and 12 policies OR'd together, each read pays that cost thousands of times. Measured: reads on `timesheet_entries` average 750 ms–1.35 s, peaking at 7.5 s.

2. **Missing combined indexes.** Only single-column indexes exist (`user_id`, `status`, `entry_date` separately). Every hot query filters on pairs/triples of these (`user_id + status`, `user_id + entry_date`, `status` alone, `user_id + status + entry_date`), so Postgres scans far more rows than needed.

3. **The dashboard downloads rows it only needs to count.** `Dashboard.tsx` fetches every pending entry's id page-by-page (1000 rows at a time) just to display a number — for admins that is the whole pending backlog, tens of thousands of rows over many round trips. That single pattern is the top query in the database by total time (7,092 calls, ~1 s each).

## The fix

### 1. Make the access rules evaluate once per query (biggest win)
Rewrite every policy on `timesheet_entries` (and the same pattern on `leave_days`, `profiles`, `user_roles` where present) to wrap the auth lookups in `(select ...)` so Postgres computes them once instead of per row. Same access rules, same results — purely a performance rewrite, no change to who can see what.

Also collapse the multiple overlapping SELECT policies per role into one policy per role/command where the logic is identical in effect, so Postgres evaluates one condition instead of several.

### 2. Add composite indexes
On `timesheet_entries`:
- `(user_id, entry_date desc)`
- `(user_id, status)`
- `(status, entry_date)`
- `(user_id, status, entry_date)`

Tradeoff: reads get much faster, inserts/updates get marginally slower, a few MB of extra storage. Well worth it at this table size.

### 3. Stop downloading rows just to count them
In `src/pages/Dashboard.tsx` (both the personal and admin paths) and the pending-count spots in `src/pages/Approvals.tsx`, replace "fetch all ids then take `.length`" with a `head: true, count: 'exact'` count query — one cheap round trip instead of dozens. Where a list is genuinely needed, select only the columns used and keep the date range bounded.

### 4. Cache what doesn't change per navigation
Role/organization/label lookups currently refetch on every page. Move them into React Query with a sensible stale time so navigating between menu items doesn't re-hit the backend for data that hasn't changed.

## Verification
After each step, run `EXPLAIN (ANALYZE, BUFFERS)` on the top slow queries to confirm index usage and that the per-row policy cost is gone, then re-check the slow-query ranking. Expected: dashboard load from 1–2 minutes down to a couple of seconds.

## Notes
- No change to permissions, data, or what any role can see.
- The 58,168 rolled-back transactions since boot are worth a look afterwards; they usually indicate requests failing and retrying, which adds to the perceived slowness.
