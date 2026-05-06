
## Problem

When an L2 user (e.g., Supriya Krishna Nair) views Reports:

- **Member View** with "All Members" calls `fetchAllMembersReport()` which fetches **all entries globally** — no scoping to the user's reportees or verticals.
- **Department View** with a specific department (e.g., IDFC) calls `fetchVerticalReport()` which correctly scopes to that vertical's members.

This causes different Total Hours and Expected Hours numbers (1404.8h vs 1219.1h, 1316.0h vs 1492.0h) because they're looking at different user populations.

## Solution

Modify `fetchAllMembersReport` to accept an optional `scopeUserIds` parameter. When an L2/L3/HOD user selects "All Members", pass their visible user IDs (from `getVisibleUserIds` or `hodDepartmentIds`) so the report is scoped to only their reportees.

### Changes

**1. `src/lib/reportQueries.ts`**
- Add optional `scopeUserIds?: string[]` parameter to `fetchAllMembersReport`
- When provided, filter `timesheet_entries` query with `.in("user_id", scopeUserIds)` and limit expected hours calculation to those users only

**2. `src/pages/Reports.tsx`**
- Before calling `fetchAllMembersReport`, resolve the L2/L3 user's visible member IDs (reusing the same `hodDepartmentIds` logic already in the component to get users from `user_verticals`)
- Pass those IDs to the scoped report function

This ensures Member View "All Members" shows the same user population as Department View for non-admin roles.
