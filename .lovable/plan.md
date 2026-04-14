

# Fix Activity Breakdown: Normalize Names, Widen Labels, Group by Category

## Problem
1. **Duplicate entries**: `activity_type` in timesheet entries uses inconsistent formats — some with underscores (`handling_sessions`), some with spaces (`handling sessions`), some with different casing. These show as separate bars.
2. **Names truncated**: Y-axis width (140px) is too narrow for long activity names like "Co-ordination for cultural / sports activities".
3. **No category grouping**: Activity types belong to parent categories (e.g., "Class preparation" belongs to "Academic Support Activities"), but the chart shows flat individual activities without grouping context.

## Solution

### 1. Normalize activity type keys in `src/lib/reportQueries.ts`
In `groupEntriesByActivityType`, normalize the key:
- Replace underscores with spaces
- Trim whitespace
- Convert to lowercase for grouping, then title-case for display
- This merges duplicates like `handling_sessions` / `handling sessions` / `Handling Sessions` into one bar

### 2. Widen Y-axis and clean display names in `src/components/reports/ActivityBreakdownChart.tsx`
- Increase YAxis `width` from 140 to 200
- Replace underscores with spaces in display names
- Title-case all names for consistency
- Reduce font size slightly if needed to fit more text

### 3. (Optional enhancement) Group bars by parent category
- Look up each activity's parent category from `activity_categories` table
- Add category grouping headers or color-code bars by category
- This requires passing categories data to the chart component

**Recommendation**: Implement items 1 and 2 first (fixes the immediate issues). Item 3 can be a follow-up if you want category-level grouping in the chart.

## Files changed
- `src/lib/reportQueries.ts` — normalize `activity_type` key in `groupEntriesByActivityType`
- `src/components/reports/ActivityBreakdownChart.tsx` — widen YAxis, clean display names

