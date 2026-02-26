

## Plan: Fix Dashboard Calculation — Timezone Bug in Date Formatting

### Root Cause

All date formatting across the app uses `date.toISOString().split("T")[0]`, which converts to **UTC** before extracting the date string. For users in timezones ahead of UTC (like IST, UTC+5:30), this shifts midnight back to the previous day in UTC, causing date queries to include entries from the wrong day.

**Example with IST user (the reported bug):**
- "Today" filter: `startOfDay(Feb 26)` = Feb 26 00:00 IST = Feb 25 18:30 UTC
- `.toISOString().split("T")[0]` = **"2026-02-25"** (wrong day!)
- Query fetches Feb 25 + Feb 26 entries = 465 + 460 = 925 min = **15.4h** instead of 7.67h
- But `getWorkingDaysInRange` uses local Date objects correctly, counting only 1 day
- So: Actual = 15.4h (doubled), Expected = 8.0h (correct), Avg/Day = 15.4h (doubled)

This explains the exact numbers shown in the screenshot.

### Fix

Create a timezone-safe local date formatting utility and replace all occurrences of the buggy pattern.

**1. Update `src/lib/dateUtils.ts`** -- Add `formatLocalDate` function and fix existing helpers:

```typescript
/** Format a Date to YYYY-MM-DD using LOCAL timezone (not UTC) */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

Also fix `getTodayISO`, `getWeekStartISO`, `getWeekEndISO`, `getMonthStartISO`, `getMonthEndISO` to use `formatLocalDate` internally instead of `toISOString()`.

**2. Update `src/pages/Dashboard.tsx`** -- Replace all `toISOString().split("T")[0]` with `formatLocalDate()`:
- Line 92: `const today = formatLocalDate(new Date());`
- Lines 132-133: leave date range
- Lines 179-180: month start/end
- Lines 222, 226: week start/end for L1
- Lines 316, 319, 323: today/week for HOD
- Lines 540, 544: week for admin

**3. Update `src/components/dashboard/EnhancedCompletionCard.tsx`** -- Lines 53-54:
- Replace `dateRange.from.toISOString().split("T")[0]` with `formatLocalDate(dateRange.from)`
- Replace `dateRange.to.toISOString().split("T")[0]` with `formatLocalDate(dateRange.to)`

**4. Update `src/pages/Timesheet.tsx`** -- Lines 48, 73, 492, 770, 884:
- Replace all `new Date().toISOString().split("T")[0]` with `formatLocalDate(new Date())`

### Files to Change

| File | Changes |
|------|---------|
| `src/lib/dateUtils.ts` | Add `formatLocalDate()` function; fix 5 existing helpers to use it |
| `src/pages/Dashboard.tsx` | Replace ~10 occurrences of `.toISOString().split("T")[0]` with `formatLocalDate()` |
| `src/components/dashboard/EnhancedCompletionCard.tsx` | Replace 2 occurrences |
| `src/pages/Timesheet.tsx` | Replace 5 occurrences |

### Why This Fixes the Issue

After this change, a user in IST at midnight local time will get `formatLocalDate(startOfDay(today))` = "2026-02-26" (correct), not "2026-02-25" (UTC-shifted). The query will only fetch entries for the intended date range, producing the correct totals.

### Impact on Other Users

This fix is safe for all timezones:
- UTC users: no change (local = UTC)
- Users behind UTC (e.g., US timezones): were potentially getting the NEXT day's date shifted forward -- also fixed
- Users ahead of UTC (IST, etc.): the reported bug -- fixed

