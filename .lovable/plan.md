

## Analysis: System-Wide Instability Root Causes

After deep investigation, I've identified **two systemic issues** that explain the widespread, intermittent failures across users and flows. These are data-layer problems that affect bulk upload, timesheet entries, and any flow that resolves vertical/department codes.

### Root Cause 1: `fetchDepartments()` fetches ALL organizations' data (no org scoping)

The `fetchDepartments()` function in `excelImportUtils.ts` (line 581) queries **all** verticals and departments across **every** organization without any org filter. The database has 55 verticals with **18 duplicate codes** across organizations (e.g., `CBI01-26` exists in both "Manipal Academy of Banking" and "MAB - Content Team").

Since the result is stored in a `Map<code, id>`, duplicate codes overwrite each other. Which UUID "wins" depends on the order Supabase returns rows -- which is non-deterministic. This explains:
- "Was working, now broken" -- query order changed
- "Random users, random times" -- different users hit different code paths depending on which UUID the map retained
- Bulk upload validation failures with incorrect error messages

### Root Cause 2: Bulk upload drops `program_id` from insert data

In `validateMemberExcelRow()`, the `programId` is resolved correctly (line 237-259) but is **never included** in the returned `data` object (line 471-491). The `program_id` field is simply missing from the insert payload. This means:
- Bulk-uploaded entries have `program_id = null`
- Dashboard/report calculations that join on `program_id` produce wrong results
- Approval queries that filter by `program_id` may miss these entries
- This discrepancy between manual entries (which have `program_id`) and bulk entries causes inconsistent behavior

### Fix Plan

**File: `src/lib/excelImportUtils.ts`**

1. **Scope `fetchDepartments()` to the current user's organization** -- accept an `organizationId` parameter and filter both the `departments` and `verticals` queries by it. This eliminates cross-org code collisions.

2. **Include `program_id` in the validated data output** -- add `program_id: programId` to the return object in `validateMemberExcelRow()` (line 475-491).

**File: `src/pages/BulkImport.tsx`**

3. **Pass `organizationId` to `fetchDepartments()`** -- fetch the user's org ID and pass it to the scoped function.

### Technical Detail

```text
// Fix 1: Scope fetchDepartments to organization
export async function fetchDepartments(organizationId?: string): Promise<Map<string, string>> {
  let deptsQuery = supabase.from('departments').select('id, code');
  let vertsQuery = supabase.from('verticals').select('id, code');
  
  if (organizationId) {
    deptsQuery = deptsQuery.eq('organization_id', organizationId);
    vertsQuery = vertsQuery.eq('organization_id', organizationId);
  }
  
  const [deptsRes, verticalsRes] = await Promise.all([deptsQuery, vertsQuery]);
  // ... rest unchanged
}

// Fix 2: Add program_id to return data (line ~475)
data: {
  ...existing fields,
  program_id: programId,   // <-- currently missing
}
```

### Files to Change

| File | Change |
|------|--------|
| `src/lib/excelImportUtils.ts` | Scope `fetchDepartments()` to org; add `program_id` to validated data output |
| `src/pages/BulkImport.tsx` | Fetch user's org ID and pass to `fetchDepartments(orgId)` |

### What Stays the Same

- All database tables, RLS policies -- unchanged
- Auth/login/logout flows -- unchanged
- Manual timesheet entry -- unchanged (already works correctly)
- All other pages and features -- unchanged

### Impact

These two fixes address the core data integrity issues. Once deployed:
- Bulk upload validation will consistently use the correct org's verticals (no more false errors)
- Bulk-uploaded entries will include `program_id`, matching manual entries
- Dashboard, reports, and approvals that depend on `program_id` will work correctly for bulk-uploaded data
- The "randomness" disappears because code-to-UUID resolution becomes deterministic within an organization

