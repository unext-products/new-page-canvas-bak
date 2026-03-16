

## Half-Day Leave: First Half / Second Half Implementation

### Summary

Replace the single "Half Day" leave type with two distinct types: "Half Day - First Half" and "Half Day - Second Half". This changes the leave enum, updates all UI labels, and introduces time-aware logic so that half-day leaves only block half of the work window and only count as 0.5 leave days in calculations.

### Database Changes

**Migration: Alter the `leave_type` enum**

```sql
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'half_day_first';
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'half_day_second';
```

Note: Postgres doesn't allow removing enum values easily. The old `half_day` value will remain in the enum but won't be offered in the UI. Any existing `half_day` records will be treated as `half_day_first` in display/logic for backward compatibility.

### Core Logic: Half-Day Time Boundaries

A helper function (`getHalfDayBoundary`) will compute the midpoint of the configured work window (from thresholds, default 08:30-17:30). The midpoint of 08:30-17:30 is 13:00.

- **First Half**: 08:30 - 13:00 (blocked for entries, leave colored)
- **Second Half**: 13:00 - 17:30 (blocked for entries, leave colored)

This will be placed in a shared utility (e.g., `src/lib/leaveUtils.ts`) so all consumers use the same logic.

### Files to Change

| File | Change |
|------|--------|
| **Database migration** | Add `half_day_first` and `half_day_second` to `leave_type` enum |
| **`src/lib/leaveUtils.ts`** (new) | Shared helper: `isHalfDayLeave()`, `getHalfDayBlockedRange()`, `getLeaveWeight()` (returns 0.5 for half-day, 1.0 for full), `formatLeaveType()` (single source of truth) |
| **`src/pages/Timesheet.tsx`** | Update leave dropdown: replace `half_day` with `half_day_first` and `half_day_second`. Update entry validation: for half-day leaves, only block entries in the blocked half; allow entries in the other half. Update `formatLeaveType` to use shared util. |
| **`src/pages/Calendar.tsx`** | **Month view**: For half-day leaves, render the day cell as half-leave/half-normal (split background or partial blue + show hours/dots for the other half). **Day view**: Only color blocked hour slots for the leave half; allow clicking/creating entries in the free half. Update `isBlocked` logic to be partial. Update `formatLeaveType`. |
| **`src/components/calendar/DayHourlyView.tsx`** | Instead of replacing the entire view with a "leave" card, show leave badge on blocked slots only and render normal entry slots for the free half. Update `formatLeaveType`. |
| **`src/components/calendar/DayMatrixView.tsx`** | For half-day leaves, only show leave badge on relevant slots; show entry data on the other half. Update `formatLeaveType`. |
| **`src/lib/reportQueries.ts`** | In `countWorkingDays`: half-day leaves subtract 0.5 instead of 1.0 from working day count. Requires fetching `leave_type` alongside `leave_date`. |
| **`src/pages/Dashboard.tsx`** | Weekly target calculation: half-day leaves subtract 0.5 from `leaveDaysThisWeek` instead of 1.0. Requires fetching `leave_type` for the week's leaves. |
| **`src/pages/Team.tsx`** | Same adjustment: half-day leaves count as 0.5 for weekly targets and monthly leave counts. |
| **`src/components/reports/MemberCalendar.tsx`** | Partial leave rendering in month grid. Day view: show leave only on blocked half. |
| **`src/components/reports/DepartmentCalendar.tsx`** | Same partial leave rendering for department-level views. |
| **`src/pages/Approvals.tsx`** | Update `formatLeaveType` to use shared util. Handle partial leave in matrix view. |
| **`src/lib/excelImportUtils.ts`** | Bulk upload validation: for half-day leave days, only reject entries that fall in the blocked half. |
| **`src/lib/thresholdValidation.ts`** | `fetchUserLeaveDays` needs to return leave type info (not just dates) so validation can distinguish half vs full day. |

### Key Design Decisions

1. **Midpoint calculation**: Uses the configured work window midpoint (not hardcoded 13:00). For 08:30-17:30, midpoint = 13:00. For custom windows like 08:30-18:30, midpoint = 13:30.

2. **Backward compatibility**: Existing `half_day` records display as "Half Day (Legacy)" and are treated as first-half for blocking logic.

3. **`countWorkingDays` signature change**: Currently takes `leaveDates: Set<string>`. Will change to accept a map of `date → leave_type` so it can apply 0.5 weight for half-day leaves.

4. **No UI design change**: The leave dialog keeps the same layout. The dropdown simply has two new items replacing one.

### What Stays the Same
- Full-day leave types (casual, sick, earned, comp_off, other) — unchanged behavior
- Approval workflows — unchanged
- Auth/session — unchanged
- Timesheet entry creation flow (except validation) — unchanged

