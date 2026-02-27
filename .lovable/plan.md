

## Plan: Fix Threshold Validation — Duplicate Rows + Wrong Vertical Lookup

### Root Causes Found

**Problem 1: Duplicate threshold rows cause silent failure**
The database has **7 duplicate org-wide threshold rows** for the same organization (org `4be340a2-...`, all with `vertical_id IS NULL`). The query uses `.maybeSingle()` which **throws an error** when more than one row matches. This error is caught silently in the try/catch block (Timesheet.tsx line 343), and the fallback validation in the catch block uses the same hook logic which also fails for the same reason. Result: **all threshold validation is skipped entirely**.

**Problem 2: Wrong vertical used for threshold lookup**
`fetchUserThresholds(userId)` reads the user's `vertical_id` from `user_roles`, but the user might be submitting an entry for a **different vertical** (selected in the entry form). For example, a user assigned to vertical A could submit for vertical B, and the system checks thresholds for A instead of B -- or finds no threshold at all.

### Fix (3 parts)

**1. Database Migration — Clean up duplicates + add unique constraint**

Remove duplicate `timesheet_thresholds` rows, keeping only the most recently updated one per (organization_id, vertical_id) combination. Then add a unique constraint to prevent future duplicates:

```sql
-- Delete duplicates, keeping the most recently updated row
DELETE FROM timesheet_thresholds
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id, COALESCE(vertical_id, '00000000-0000-0000-0000-000000000000'))
    id
  FROM timesheet_thresholds
  ORDER BY organization_id, COALESCE(vertical_id, '00000000-0000-0000-0000-000000000000'), updated_at DESC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_timesheet_thresholds_org_vertical
  ON timesheet_thresholds (organization_id, COALESCE(vertical_id, '00000000-0000-0000-0000-000000000000'));
```

**2. Update `src/lib/thresholdValidation.ts` — Make queries resilient + accept entry vertical**

- Change `fetchUserThresholds` signature to accept an optional `entryVerticalId` parameter
- Replace all `.maybeSingle()` calls with `.order('updated_at', { ascending: false }).limit(1)` and read `data[0]` — this returns the latest row even if duplicates exist, instead of throwing an error
- When `entryVerticalId` is provided, use it to look up vertical-specific thresholds instead of the user's primary vertical from `user_roles`
- Apply the same resilience fix to `fetchExtendedValidationContext`

**3. Update `src/pages/Timesheet.tsx` — Pass selected vertical to threshold check**

- At line 305, change `fetchUserThresholds(userWithRole.user.id)` to `fetchUserThresholds(userWithRole.user.id, selectedVerticalId)` so the threshold for the entry's vertical is checked, not the user's primary vertical

### Files to Change

| File | Change |
|------|--------|
| Database migration | Remove duplicate threshold rows + add unique index |
| `src/lib/thresholdValidation.ts` | Add `entryVerticalId` param to `fetchUserThresholds`; replace `.maybeSingle()` with `.order().limit(1)` for resilience |
| `src/pages/Timesheet.tsx` | Pass `selectedVerticalId` to `fetchUserThresholds` call |

### Why This Is a Permanent Fix

1. The unique constraint prevents duplicates from ever being created again
2. The `.limit(1)` pattern is resilient even if constraints are somehow bypassed
3. Using the entry's selected vertical ensures the correct thresholds are always checked
4. All existing functionality is preserved — the fallback from vertical-specific to org-wide thresholds still works

