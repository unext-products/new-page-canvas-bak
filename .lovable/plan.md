

## Root Cause Analysis

**All working-day calculations across the app use `isWeekend()` to exclude non-working days but never query the `holidays` table.** Holidays (like March 19) are invisible to these calculations, so the system counts them as full working days.

Affected locations:
1. **`EnhancedCompletionCard.tsx` line 79** — `isWeekend(day)` only
2. **`reportQueries.ts` `countWorkingDays()` line 461** — `isWeekend(day)` only
3. **`Dashboard.tsx` line 149** — hardcoded `5` base working days per week
4. **`Team.tsx` line 268** — hardcoded `5` base working days per week

The `useThresholds` hook already fetches holidays and exposes `isHoliday()`, but none of these calculation paths use it.

## Fix Plan

### Step 1: Make `countWorkingDays` holiday-aware (central fix)

**File: `src/lib/reportQueries.ts`**

Add a `holidayDates` parameter (a `Set<string>`) to `countWorkingDays()`. Inside the loop, after the `isWeekend` check, skip days that are in `holidayDates`:

```typescript
export function countWorkingDays(
  dateFrom: Date, dateTo: Date,
  leaveDates: Set<string> = new Set(),
  leaveTypeMap?: Map<string, string>,
  holidayDates: Set<string> = new Set()  // NEW
): number {
  ...
  for (const day of allDays) {
    if (isWeekend(day)) continue;
    const dateStr = format(day, "yyyy-MM-dd");
    if (holidayDates.has(dateStr)) continue;  // NEW — skip holidays
    // ... existing leave logic
  }
}
```

Also update `calculateExpectedHours()` similarly to accept and use holiday dates.

### Step 2: Pass holidays into report calculations

**File: `src/lib/reportQueries.ts`**

In `fetchFacultyReport()`, fetch holidays for the user's org and pass them to `countWorkingDays()`:

```typescript
// Fetch holidays for the user's org
const { data: holidays } = await supabase
  .from("holidays")
  .select("holiday_date")
  .eq("organization_id", orgId);
const holidayDates = new Set(holidays?.map(h => h.holiday_date) || []);

// Pass to countWorkingDays
countWorkingDays(start, end, leaveDates, leaveMap, holidayDates);
```

### Step 3: Fix `EnhancedCompletionCard.tsx`

**File: `src/components/dashboard/EnhancedCompletionCard.tsx`**

Fetch holidays for the user's org in parallel with entries/leaves/target. Add a holiday check in the working-days loop:

```typescript
// In fetchCompletionData, add holidays fetch
const [entriesRes, leavesRes, targetBreakdown, holidaysRes] = await Promise.all([
  ...existing...,
  supabase
    .from("holidays")
    .select("holiday_date")
    .eq("organization_id", userOrgId)  // need to resolve user's org
]);

const holidayDates = new Set(holidaysRes.data?.map(h => h.holiday_date) || []);

// In the loop:
if (isWeekend(day)) continue;
if (holidayDates.has(dateStr)) continue;  // NEW
```

Will also need to fetch the user's `organization_id` from `user_roles`.

### Step 4: Fix Dashboard weekly target

**File: `src/pages/Dashboard.tsx`**

Replace hardcoded `5` with actual count. Fetch holidays for the current week and subtract them:

```typescript
const { data: weekHolidays } = await supabase
  .from("holidays")
  .select("holiday_date")
  .eq("organization_id", orgId)
  .gte("holiday_date", weekStartStr)
  .lte("holiday_date", weekEndStr);

const holidayCount = weekHolidays?.length || 0;
const workingDaysThisWeek = Math.max(0, 5 - holidayCount - leaveDaysThisWeek);
```

### Step 5: Fix Team page weekly target

**File: `src/pages/Team.tsx`**

Same pattern as Dashboard — fetch holidays for the week and subtract:

```typescript
const workingDaysThisWeek = Math.max(0, 5 - holidayCount - memberWeekLeaveDays);
```

### Files to change

| File | Change |
|------|--------|
| `src/lib/reportQueries.ts` | Add `holidayDates` param to `countWorkingDays` and `calculateExpectedHours`; fetch holidays in `fetchFacultyReport` |
| `src/components/dashboard/EnhancedCompletionCard.tsx` | Fetch user's org holidays; skip holiday dates in working-days loop |
| `src/pages/Dashboard.tsx` | Fetch week's holidays; subtract from base working days |
| `src/pages/Team.tsx` | Fetch week's holidays; subtract from base working days |

