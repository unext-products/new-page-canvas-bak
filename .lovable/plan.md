

## Plan: Fix Bulk Upload Program-Vertical Validation Failure

### Root Cause

There are **duplicate vertical codes** in the database (e.g., two verticals with code `CBI01-26` across different organizations, IDs `560df76c` and `91c87428`).

The `fetchDepartments()` function builds a `Map<code, id>`. Since Maps overwrite duplicate keys, only one vertical ID is kept for code `CBI01-26`. When the user's program points to the OTHER vertical with the same code, the ID comparison `programInfo.vertical_id !== deptId` fails, producing the false error "Program 'PGDBF' does not belong to vertical 'CBI01-26'".

This worked before because the Map happened to store the correct ID, but any change in query ordering could flip which duplicate "wins."

### Fix

**File: `src/lib/excelImportUtils.ts`**

Change the program-vertical validation (line 256) to compare **vertical codes** instead of **UUIDs**. This requires:

1. Expand the `userProgramsMap` type to include `vertical_code?: string`
2. In the validation check, compare `programInfo.vertical_code` against `deptCodeUpper` (the code from the Excel) instead of comparing `programInfo.vertical_id` against `deptId`

**File: `src/pages/BulkImport.tsx`**

When building `userProgramsMap` (around line 286-300):

1. Join with the verticals table to get the vertical code for each program
2. Store `vertical_code` alongside `vertical_id` in the map entries

### Technical Detail

Current broken logic:
```typescript
// deptId from Map can be wrong vertical UUID when duplicate codes exist
} else if (deptId && programInfo.vertical_id !== deptId) {
  errors.push(`Program does not belong to vertical`);
```

Fixed logic:
```typescript
// Compare codes (strings) — immune to duplicate UUIDs
} else if (programInfo.vertical_code && programInfo.vertical_code !== deptCodeUpper) {
  errors.push(`Program does not belong to vertical`);
```

In BulkImport.tsx, fetch vertical codes when building the map:
```typescript
const { data: progs } = await supabase
  .from("programs")
  .select("id, code, name, vertical_id, verticals!inner(code)")
  .in("id", userProgIds);

// Store vertical_code in the map
userProgramsMap.set(p.code.toUpperCase(), {
  id: p.id,
  vertical_id: p.vertical_id || "",
  vertical_code: p.verticals?.code?.toUpperCase() || "",
  name: p.name
});
```

### Files to Change

| File | Change |
|------|--------|
| `src/lib/excelImportUtils.ts` | Add `vertical_code` to the map type; compare codes instead of IDs at line 256 |
| `src/pages/BulkImport.tsx` | Join verticals when fetching programs to get vertical codes; pass them in the map |

### What Stays the Same

- All other validation (time, date, overlap, thresholds, holidays) -- unchanged
- Admin bulk upload flow -- unchanged
- Manual timesheet entry -- unchanged
- All database tables and RLS -- unchanged

