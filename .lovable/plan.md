

## Analysis: Workload Calculation for Exited Faculty and Reporting Gaps

### Current System Behavior

**How workload is currently calculated:**

1. **Individual faculty report** (`fetchFacultyReport`): Queries `timesheet_entries` by `user_id` + date range. This works correctly regardless of active/inactive status or vertical assignment — it finds all entries the user ever created. Expected hours = working days in full period × daily target. No adjustment for deactivation date.

2. **Vertical/Department report** (`fetchVerticalReport`): First queries `user_verticals` to get user IDs assigned to that vertical, then fetches entries for those users filtered by `vertical_code`. This is where the problem occurs.

### Issue 1: No Deactivation Date Tracking

**Gap:** The `profiles` table has `is_active` (boolean) but no `deactivated_at` timestamp. When calculating expected hours for Raghavendra (period Feb 16 – Mar 15):

- The system counts all working days in the period (approximately 20 days)
- It calculates expected = 20 × 8 hours = 160 hours
- But Raghavendra's last working day was Feb 28, so his realistic expected should be ~9 working days × 8 = 72 hours
- His completion rate appears artificially low because the denominator is inflated

**Impact:** Completion rates for exited faculty are misleadingly low, dragging down department-level metrics.

### Issue 2: Vertical Report Loses Historical Data When Faculty is Moved

**The exact chain of events:**

1. Faculty members left → marked inactive (`is_active = false`)
2. They still appeared in L2's dashboard because dashboard queries `user_verticals` (which still had their original vertical)
3. Admin tried removing the vertical but couldn't save (the system requires at least one vertical assignment)
4. Workaround: moved them to a dummy vertical
5. Now `fetchVerticalReport` for the original vertical queries `user_verticals` → doesn't find these users anymore → their entries are excluded from the department report
6. Individual faculty report still works because it queries by `user_id` directly, not through `user_verticals`

**Root cause in code** (`fetchVerticalReport`, lines 292-298):
```
const { data: vertUsers } = await supabase
  .from("user_verticals")
  .select("user_id")
  .eq("vertical_id", verticalId);
userIds = [...new Set(vertUsers?.map(u => u.user_id) || [])];
```
This only finds users *currently* assigned to the vertical. Historical entries with matching `vertical_code` from reassigned users are silently dropped.

### Proposed Fixes

**A. Add `deactivated_at` timestamp to `profiles` table**

- New column: `deactivated_at timestamptz NULL`
- Auto-set via a trigger when `is_active` changes from `true` to `false`
- Clear it when `is_active` changes back to `true`
- Use this date in expected-hours calculations: for inactive users, cap the period end at `deactivated_at`

**B. Fix vertical report to include historical entries from reassigned/inactive users**

Currently the report finds users via `user_verticals` then fetches their entries. Instead, it should **also** include any entries with matching `vertical_code` regardless of current assignment. This means:

- Keep the current `user_verticals` lookup for active user discovery
- Additionally query `timesheet_entries` directly by `vertical_code` within the date range to catch entries from users who have since been reassigned
- Merge the two sets of user IDs (current assignment + historical entries)

**C. Fix dashboard/team visibility to respect `is_active` status**

The L2 dashboard should filter out inactive users from the active team list. This would have prevented Ann Mary's issue without needing the dummy-vertical workaround:

- Dashboard team queries should add `.eq("is_active", true)` when joining profiles
- The "faculty list" shown to L2/L3 should exclude inactive profiles by default

**D. Allow saving user edits with no vertical (for inactive users)**

The admin edit form should allow removing all verticals from an inactive user. This eliminates the need for a dummy vertical workaround:

- In the user edit dialog, skip the "at least one vertical required" validation when the user is inactive

### Files to Change

| File | Change |
|------|--------|
| Database migration | Add `deactivated_at` column + trigger on `profiles` |
| `src/lib/reportQueries.ts` | `fetchVerticalReport`: also discover users from historical entries by `vertical_code`; `fetchFacultyReport`: cap expected hours at `deactivated_at` for inactive users |
| `src/pages/Dashboard.tsx` | Filter team member lists by `is_active = true` |
| `src/pages/Users.tsx` | Allow saving with no vertical when user is inactive |

### What Stays the Same
- Individual faculty report accuracy — already correct
- Timesheet entry creation/submission — unchanged
- Approval workflows — unchanged
- Auth/session fixes — unchanged

