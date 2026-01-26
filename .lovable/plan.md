
## Plan: Fix User Edit Multi-Vertical Save Error and Bulk Upload Threshold Validation

### Overview
This plan addresses two critical issues:
1. **User Edit Foreign Key Error** - Saving user edits with multiple verticals fails with "user_roles_department_id_fkey" violation
2. **Bulk Upload Threshold Validation** - Work Hour Window thresholds (08:30-17:30) are not enforced during bulk upload, allowing entries outside allowed hours

---

### Issue 1: User Edit Multi-Vertical Save Error

**Root Cause Analysis:**

The error occurs in `src/pages/Users.tsx` in the `handleEdit` function (line 577):
```typescript
department_id: formData.role === "org_admin" ? null : deptIds[0] || null,
```

The problem:
1. When editing a user with vertical assignments, `formData.department_ids` is empty
2. `deptIds` gets set to the first vertical ID from `formData.vertical_ids` (line 568 fallback logic)
3. The code then tries to set `user_roles.department_id` to a vertical ID
4. Since `user_roles.department_id` has a foreign key to the `departments` table, and vertical IDs don't exist in that table, the FK constraint fails

**Fix in `src/pages/Users.tsx`:**

A. Update the `handleEdit` function to properly handle vertical_id vs department_id:

```typescript
// Update or insert user role
if (formData.role) {
  // Keep department_ids separate from vertical_ids
  const deptIds = formData.department_ids.length > 0 ? formData.department_ids : 
                  (formData.department_id ? [formData.department_id] : []);
  const vertIds = formData.vertical_ids.length > 0 ? formData.vertical_ids : [];
  const progIds = formData.program_ids.length > 0 ? formData.program_ids : 
                  (formData.program_id ? [formData.program_id] : []);
  
  // For user_roles table:
  // - department_id: use actual department ID (from departments table) or NULL
  // - vertical_id: use first vertical ID from verticals table
  // DON'T mix vertical IDs with department_id field
  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert(
      {
        user_id: selectedUser.id,
        role: displayToDbRole[formData.role],
        // Only set department_id if it's an actual department ID, otherwise NULL
        department_id: formData.role === "org_admin" || formData.role === "admin" ? null : 
                       (deptIds.length > 0 ? deptIds[0] : null),
        // Set vertical_id for the primary vertical reference
        vertical_id: formData.role === "org_admin" || formData.role === "admin" ? null : 
                     (vertIds.length > 0 ? vertIds[0] : null),
        program_id: (formData.role === "program_manager" || formData.role === "member" || 
                     formData.role === "l1" || formData.role === "l2") ? progIds[0] || null : null,
      },
      { onConflict: 'user_id' }
    );

  if (roleError) throw roleError;

  // Sync user_verticals junction table (DON'T fallback to deptIds)
  if (formData.role !== "org_admin" && formData.role !== "admin" && vertIds.length > 0) {
    // Delete and insert vertical assignments
    // ... existing logic but use vertIds directly, not fallback
  }
}
```

B. Update the `openEditDialog` function to NOT mix vertical_ids with department_ids:

```typescript
// Keep vertical_ids and department_ids separate
setFormData({
  // ...
  department_id: deptIds[0] || user.department_id || "",
  department_ids: deptIds,  // Keep as actual department IDs only
  vertical_ids: verticalIds,  // Keep as actual vertical IDs only
  // ...
});
```

---

### Issue 2: Bulk Upload Threshold Validation Missing

**Root Cause Analysis:**

The validation functions in `src/lib/excelImportUtils.ts` (`validateMemberExcelRow` and `validateAdminExcelRow`) do not check:
1. Work Hour Window constraints (08:30-17:30)
2. Maximum hours per day
3. Holiday restrictions
4. Working day restrictions

The `useThresholds` hook has a `validateEntry` function that performs these checks, but it's a React hook and cannot be used directly in utility functions.

**Solution:**

Create a standalone threshold validation function that can be called from the bulk import validation. This function will:
1. Fetch the organization's threshold settings
2. Check work hour window constraints
3. Return appropriate error messages for violations

**Fix 1: Create new utility function in `src/lib/thresholdValidation.ts`:**

```typescript
import { supabase } from "@/integrations/supabase/client";

interface ThresholdValidationResult {
  valid: boolean;
  error?: string;
}

interface Thresholds {
  work_hours_enabled: boolean;
  work_start_time: string;
  work_end_time: string;
  max_hours_enabled: boolean;
  max_hours_minutes: number;
}

/**
 * Fetch thresholds for a user's organization
 */
export async function fetchUserThresholds(userId: string): Promise<Thresholds | null> {
  // Get user's organization
  const { data: userRole } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (!userRole?.organization_id) return null;

  // Fetch org-wide thresholds
  const { data: thresholds } = await supabase
    .from("timesheet_thresholds")
    .select("*")
    .eq("organization_id", userRole.organization_id)
    .is("vertical_id", null)
    .single();

  if (!thresholds) return null;

  return {
    work_hours_enabled: thresholds.work_hours_enabled,
    work_start_time: thresholds.work_start_time || "08:30:00",
    work_end_time: thresholds.work_end_time || "17:30:00",
    max_hours_enabled: thresholds.max_hours_enabled,
    max_hours_minutes: thresholds.max_hours_minutes || 480,
  };
}

/**
 * Validate a timesheet entry against thresholds
 */
export function validateAgainstThresholds(
  startTime: string,
  endTime: string,
  thresholds: Thresholds | null
): ThresholdValidationResult {
  if (!thresholds) return { valid: true };

  // Check work hour window
  if (thresholds.work_hours_enabled) {
    const workStart = thresholds.work_start_time.slice(0, 5);
    const workEnd = thresholds.work_end_time.slice(0, 5);

    if (startTime < workStart || endTime > workEnd) {
      return {
        valid: false,
        error: `Entry must be within work hours (${workStart} - ${workEnd}). Your entry: ${startTime} - ${endTime}`,
      };
    }
  }

  return { valid: true };
}
```

**Fix 2: Update `src/lib/excelImportUtils.ts` to use threshold validation:**

Add threshold validation to `validateMemberExcelRow`:

```typescript
// Import the new function
import { fetchUserThresholds, validateAgainstThresholds } from "./thresholdValidation";

// In validateMemberExcelRow function, add threshold validation:
export async function validateMemberExcelRow(
  row: MemberExcelRow,
  userId: string,
  userDepartmentId: string,
  deptsMap: Map<string, string>,
  userDeptCodes?: Set<string>,
  thresholds?: Thresholds | null  // Add threshold parameter
): Promise<ValidationResult> {
  // ... existing validation ...

  // After time format validation, add threshold check:
  if (thresholds && timeRegex.test(row.start_time) && timeRegex.test(row.end_time)) {
    const thresholdResult = validateAgainstThresholds(row.start_time, row.end_time, thresholds);
    if (!thresholdResult.valid) {
      errors.push(thresholdResult.error!);
    }
  }

  // ... rest of validation ...
}
```

**Fix 3: Update `src/pages/BulkImport.tsx` to fetch and pass thresholds:**

```typescript
// In handleParseAndValidate function:
if (isMember || isManager) {
  // ... existing code ...

  // Fetch thresholds for the target user
  const thresholds = await fetchUserThresholds(targetUserId!);

  results = await Promise.all(
    rows.map(async (row, index) => {
      const validation = await validateMemberExcelRow(
        row, targetUserId!, targetDepartmentId || "", deptsMap, userDeptCodes,
        thresholds  // Pass thresholds
      );
      return { rowNumber: index + 2, rowData: row, ...validation };
    })
  );
}
```

Similarly update the admin validation path.

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `src/pages/Users.tsx` | Fix `handleEdit` to separate vertical_ids from department_ids, don't set department_id to vertical UUID |
| `src/lib/thresholdValidation.ts` | NEW FILE - Standalone threshold validation functions |
| `src/lib/excelImportUtils.ts` | Add threshold validation to `validateMemberExcelRow` and `validateAdminExcelRow` |
| `src/pages/BulkImport.tsx` | Fetch thresholds and pass to validation functions |

---

### Technical Details

**Issue 1 - Foreign Key Fix:**
- `user_roles.department_id` references `departments(id)` - legacy field
- `user_roles.vertical_id` references `verticals(id)` - new hierarchy field  
- The code was incorrectly setting `department_id` to vertical UUIDs
- Fix: Set `vertical_id` for verticals, keep `department_id` NULL or actual department ID

**Issue 2 - Threshold Validation:**
- Thresholds are stored in `timesheet_thresholds` table
- `work_hours_enabled` with `work_start_time`/`work_end_time` defines allowed window
- Bulk upload validation must fetch and apply these constraints
- Error message will show: "Entry must be within work hours (08:30 - 17:30). Your entry: 17:00 - 18:00"

---

### Testing Checklist

- [ ] As Admin, edit Moses (L1) and assign 2 verticals - save should succeed without FK error
- [ ] Verify user_roles has correct vertical_id set (first vertical)
- [ ] Verify user_verticals has both vertical assignments
- [ ] As Moses, try bulk upload with entry 17:00-18:00 - should fail validation with work hour error
- [ ] As Moses, try bulk upload with entry 09:00-10:00 - should pass validation
- [ ] Existing single timesheet entry validation continues to work
