## Problem

The Pending Approvals report shows 136 pending for Sarika Hegde (L2), but the Approvals page shows 519 (with date filter) / 523 (all dates). The report only uses `reporting_hierarchy` for L2 scoping, missing program-based L1 users.

## Solution

Update `src/pages/PendingApprovals.tsx` to mirror the Approvals page logic for L2 users by combining hierarchy reportees AND program-based L1/faculty users.

### Changes — `src/pages/PendingApprovals.tsx`

In the `fetchData` function, within the `isL2OrL3 && !isAdmin` block (lines ~78-102), after fetching hierarchy reportees:

1. For L2 users specifically, also query `user_programs` for the current user's program IDs
2. Get all users in those programs from `user_programs`
3. Filter those to L1/faculty roles via `user_roles`
4. Add them to `scopedSubmitterIds` (the existing Set)

This matches the additive scoping pattern already used in `Approvals.tsx` (lines 196-230).

**Expected result**: Sarika Hegde's pending count will change from 136 to 523, aligning with the Approvals page.
