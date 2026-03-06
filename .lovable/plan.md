

## Plan: Fix Bulk Upload Slow Validation and False "Incorrect Program Name" Errors

### Root Cause Analysis

**Issue 1 — Slow validation:**
The pre-validation setup in `BulkImport.tsx` (lines 227-333) makes ~10 sequential database roundtrips before any row validation begins. Many of these queries have no dependencies on each other but are awaited one after another:

```text
1. user_roles (org ID)         -- MUST be first (others depend on orgId)
2. fetchDepartments(orgId)     -- depends on #1
3. user_departments + user_verticals  -- parallel, depends on targetUserId
4. departments.select("code")  -- depends on #3 results
5. verticals.select("code")    -- depends on #3 results
6. user_programs               -- independent of #3-5
7. programs.select(...)        -- depends on #6
8. fetchExtendedValidationContext  -- depends on #1 (orgId)
9. fetchUserLeaveDays          -- independent
10. timesheet_entries (existing) -- independent
```

After getting `orgId` and `targetUserId` (step 1), steps 2-10 can be mostly parallelized into 2-3 batches instead of running sequentially. This would cut validation setup time from ~10 roundtrips to ~3.

**Issue 2 — False "Incorrect Program Name":**
Two causes identified:

a) **No `.trim()` on Excel input values.** Excel cells frequently contain trailing whitespace. The code does `row.program.toUpperCase()` but never trims. A cell value of `"PGDBF "` (trailing space) won't match the DB code `"PGDBF"`. This affects program name, department code, and activity type lookups. Different users create files differently, explaining why it's intermittent.

b) **Same auth token-refresh vulnerability as Timesheet.tsx.** The BulkImport page reads `userWithRole?.user.id` directly (line 230) without ref stabilization. During a token refresh, `userWithRole` can be momentarily `null`, causing `orgId` to be `undefined`. This makes `fetchDepartments(undefined)` fetch ALL organizations' verticals, re-introducing the cross-org collision bug. If validation runs during this window, program lookups use wrong vertical IDs, producing false errors.

### Fix Plan

**File: `src/lib/excelImportUtils.ts`**

1. **Add `.trim()` to all user-input fields** in `validateMemberExcelRow` and `validateAdminExcelRow`. Trim `row.program`, `row.department_code`, `row.activity_type`, `row.batch`, `row.subject`, and `row.member_email` before any comparison. This is a one-line-per-field fix that prevents whitespace mismatches.

**File: `src/pages/BulkImport.tsx`**

2. **Add ref stabilization for `userWithRole`** — same pattern already applied to `Timesheet.tsx`. Use `useRef` to maintain a stable reference so that async handlers don't see a null user during token refresh.

3. **Parallelize pre-validation queries** — after getting `orgId` and `targetUserId`, fire independent queries simultaneously using `Promise.all`:

```text
// Current: sequential (~10 roundtrips)
const deptsMap = await fetchDepartments(orgId);        // 2 queries
const [userDepsRes, userVertsRes] = await Promise.all([...]); // 2 queries
const deptCodes = await supabase...("departments");    // 1 query
const vertCodes = await supabase...("verticals");      // 1 query
const userProgsData = await supabase...("user_programs"); // 1 query
const progs = await supabase...("programs");           // 1 query
const validationContext = await fetchExtendedValidationContext(); // 7 queries
const userLeaveDays = await fetchUserLeaveDays();      // 1 query
const existingEntries = await supabase...("timesheet_entries"); // 1 query

// Fixed: parallel (~3 roundtrips)
const [deptsMap, userDepsRes, userVertsRes, userProgsData, validationContext, userLeaveDays, existingEntries] = 
  await Promise.all([
    fetchDepartments(orgId),
    supabase.from("user_departments")...,
    supabase.from("user_verticals")...,
    supabase.from("user_programs")...,
    fetchExtendedValidationContext(targetUserId),
    fetchUserLeaveDays(targetUserId),
    supabase.from("timesheet_entries")...,
  ]);
// Then sequentially: dept/vert codes (depend on userDepsRes/userVertsRes) and program details (depends on userProgsData)
```

### Files to Change

| File | Change |
|------|--------|
| `src/lib/excelImportUtils.ts` | Add `.trim()` to all user-input fields before validation |
| `src/pages/BulkImport.tsx` | Add `useRef` for `userWithRole`; parallelize pre-validation queries |

### What Stays the Same
- All validation logic (thresholds, holidays, overlaps) -- unchanged
- Database tables, RLS policies -- unchanged
- Manual timesheet entry -- unchanged
- Admin bulk upload mode -- unchanged (but gets the `.trim()` benefit)
- Template generation -- unchanged

