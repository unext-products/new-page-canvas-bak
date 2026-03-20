

## Root Cause Analysis

The Timesheet page's `handleSubmit` was refactored to use "fresh thresholds" fetched directly from the database (line 333-371). This new code path only validates work-hour windows and max daily hours. It **skips holiday and working-day checks entirely**.

The hook-based `validateEntry` (which does check holidays and working days) is only called in the `catch` block (line 373-384) as a fallback when the fresh fetch fails. So under normal conditions, holidays are never checked.

The Calendar page is unaffected because it still uses `validateEntry` from the hook directly.

## Fix

**File: `src/pages/Timesheet.tsx`**

Add holiday and working-day validation in `handleSubmit`, right after the future-date check (around line 307) and before the fresh thresholds block. This uses the same `useThresholds` hook data already available:

1. Import `getDay` from `date-fns` (if not already imported)
2. Destructure `isHoliday` and `isWorkingDay` from `useThresholds` (line 66 currently only destructures `validateEntry` and `thresholds`)
3. After the future-date check (line 307), add:
   - Holiday check: call `isHoliday(entryDate)` — if truthy, block with error toast
   - Working day check: call `isWorkingDay(new Date(entryDate))` — if false, block with error toast

This mirrors the same checks already in `validateEntry` within `useThresholds.ts` (lines 240-256) and in Calendar's flow.

**No other files need changes.** Calendar and Bulk Upload already validate holidays through their respective paths.

