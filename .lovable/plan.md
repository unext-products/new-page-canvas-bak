

## Plan: Fix Work Hour Window Threshold Enforcement

### Root Cause

The threshold validation functions in `src/lib/thresholdValidation.ts` only query **org-wide** thresholds (where `vertical_id IS NULL`). But admins can set thresholds at the **vertical (department) level** -- as shown in your screenshot where "Central Bank of India" vertical has 08:30-17:30 configured.

When a user submits a timesheet entry:
- **Individual entries**: `fetchUserThresholds()` runs, queries only org-wide thresholds, finds none (because they're set at vertical level), returns `null`, and validation is skipped entirely
- **Bulk upload**: `fetchExtendedValidationContext()` has the same problem -- only checks org-wide thresholds

The `useThresholds` hook (line 93-113) already has the correct logic: check vertical-specific first, fall back to org-wide. But the direct DB fetch functions used during submission bypass the hook and miss vertical thresholds.

### Fix

Update two functions in `src/lib/thresholdValidation.ts`:

**1. `fetchUserThresholds(userId)`** -- Add vertical-aware lookup:
- Query the user's `vertical_id` from `user_roles` (in addition to `organization_id`)
- If user has a `vertical_id`, first check for vertical-specific thresholds
- If no vertical-specific thresholds found, fall back to org-wide thresholds
- This mirrors the cascade logic already in `useThresholds` hook

**2. `fetchExtendedValidationContext(userId)`** -- Add vertical-aware lookup:
- Same approach: get the user's `vertical_id`
- For thresholds: check vertical-specific first, then org-wide
- For working days: check vertical-specific first, then org-wide
- For holidays: include both org-wide AND vertical-specific holidays (union)

### Files to Change

| File | Change |
|------|--------|
| `src/lib/thresholdValidation.ts` | Update `fetchUserThresholds` and `fetchExtendedValidationContext` to query the user's `vertical_id` and check vertical-specific settings before falling back to org-wide |

No other files need changes -- Timesheet.tsx and BulkImport.tsx already call these functions correctly; they just need to return the right data.

### Technical Details

**Updated `fetchUserThresholds`:**
```text
1. Query user_roles for BOTH organization_id AND vertical_id (+ department_id for backward compat)
2. If user has a vertical_id:
   a. Query timesheet_thresholds WHERE organization_id = X AND vertical_id = user's vertical
   b. If found, return those thresholds
3. Fall back: query timesheet_thresholds WHERE organization_id = X AND vertical_id IS NULL
4. Return result (or null if nothing found)
```

**Updated `fetchExtendedValidationContext`:**
```text
Same cascade for thresholds and working_days queries.
For holidays: fetch BOTH org-wide (vertical_id IS NULL) AND vertical-specific, merge them.
```

### Why This Fixes the Issue

The entry 17:00-18:30 was accepted because `fetchUserThresholds` returned `null` (no org-wide threshold existed -- it was set at the vertical level). After this fix, the function will find the vertical-level threshold (08:30-17:30, work_hours_enabled=true) and correctly block entries outside that window.

