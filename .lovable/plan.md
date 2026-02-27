

## Plan: Fix Report Data Truncation Due to Query Row Limit

### Root Cause

The database client has a **default limit of 1,000 rows per query**. The "All Verticals" department report queries all timesheet entries across all users for a date range. For February 2026, there are **7,366 entries** (5,171 for Feb 16-28 alone). The query silently returns only the first 1,000 rows, causing faculty whose entries fall beyond row 1,000 to be completely absent from the report.

This explains:
- Faculty like Manohar, Thara, and others having entries visible on the platform (individual queries for a single user return well under 1,000 rows) but missing from the downloaded "All Verticals" report
- The "60 faculty showing nil" issue -- those faculty have entries in the database, but their entries were truncated by the 1,000-row cap

### Fix

**File: `src/lib/reportQueries.ts`**

1. Add a **paginated fetch helper** that loops through results using `.range(offset, offset+pageSize)` until all rows are retrieved:

```text
async function fetchAllEntries(query): Entry[] {
  const PAGE_SIZE = 1000;
  let allData = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    allData.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allData;
}
```

2. Update `fetchVerticalReport` (line ~301-319) to use the paginated helper instead of a single query, ensuring all 7,000+ entries are fetched.

3. Update `fetchTimesheetEntries` (line ~74-95) with the same pagination pattern, as it's also used for report filtering and could hit the same limit.

**File: `src/pages/Dashboard.tsx`**

4. Review and fix the HOD/Admin dashboard queries that use `.in("user_id", teamUserIds)` with `.eq("status", "submitted")` -- these could also exceed 1,000 rows for large organizations. Add pagination or explicit higher limits where needed.

### Summary of Changes

| File | Change |
|------|--------|
| `src/lib/reportQueries.ts` | Add `fetchAllEntries` paginated helper; update `fetchVerticalReport` and `fetchTimesheetEntries` to use it |
| `src/pages/Dashboard.tsx` | Add pagination to HOD/Admin pending approvals and weekly entries queries that aggregate across many users |

### Why This Fixes the Issue

After pagination, the report query will fetch all 7,366 entries (in ~8 pages of 1,000), ensuring every faculty member's data appears in the downloaded report. Individual user queries (Member View, personal dashboard) are unaffected since a single user rarely exceeds 1,000 entries in a month.

