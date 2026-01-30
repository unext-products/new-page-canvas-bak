
## Plan: Fix Department Report Export, Leave Validation, and Remove Subject/Details Field

### Overview
This plan addresses three issues:
1. **Department View Export Not Clickable** - Export dropdown items are visible but not clickable in Department View
2. **Leave Day Validation for Bulk Upload** - Entries should be blocked on days when user has marked leave
3. **Remove Subject/Details Field** - Remove the optional "Subject / Details" field from timesheet entry dialogs

---

### Issue 1: Department View Export Not Clickable

**Root Cause Analysis:**

Looking at `src/pages/Reports.tsx` lines 246-251:
```typescript
const hasData = currentReport && (
  reportType === "member" 
    ? facultyReport?.entries.length > 0 
    : departmentReport?.facultyBreakdown.length > 0
);
```

The button is disabled when `!hasData` (line 271). The `hasData` check looks at:
- Member view: `facultyReport?.entries.length > 0`
- Department view: `departmentReport?.facultyBreakdown.length > 0`

The Export button is correctly enabled (since you mentioned options appear), but the DropdownMenuItems at lines 278-279 may not be functioning due to a UI component issue.

After reviewing the code, the actual issue is that the dropdown is showing but the items may be covered by other elements OR the click handlers aren't firing because the data check passes but the actual export functions don't work.

Looking at the export handlers (lines 224-243):
```typescript
const handleExportCSV = () => {
  // ...
  if (reportType === "member" && facultyReport) {
    exportMemberReportCSV(facultyReport, reportPeriod, generatedBy, period);
  } else if (reportType === "department" && departmentReport) {
    exportDepartmentReportCSV(departmentReport, reportPeriod, generatedBy, period);
  }
};
```

The logic is correct. The issue is likely with the dropdown menu styling or z-index. The DropdownMenuContent needs proper positioning.

**Fix in `src/pages/Reports.tsx`:**

Add z-index and alignment props to ensure dropdown menu items are clickable:
```typescript
<DropdownMenuContent align="end" className="z-50">
  <DropdownMenuItem onClick={handleExportCSV}>Export to CSV</DropdownMenuItem>
  <DropdownMenuItem onClick={handleExportPDF}>Export to PDF</DropdownMenuItem>
</DropdownMenuContent>
```

---

### Issue 2: Leave Day Validation in Bulk Upload

**Current State:**
- Single timesheet entry (Timesheet.tsx line 255-263) checks `userLeaveDays` before submission
- Calendar.tsx (lines 259-266, 298-305) also checks leave days
- Bulk import validation does NOT check if the target user has leave on that date

**Solution:**

Add leave day validation to bulk import by:
1. Extending `thresholdValidation.ts` to include a function to fetch user leave days
2. Updating `excelImportUtils.ts` to check leave days during validation
3. Updating `BulkImport.tsx` to fetch and pass leave days to validation

**File Changes:**

**A. `src/lib/thresholdValidation.ts`** - Add leave day fetching:
```typescript
/**
 * Fetch leave days for a user within a date range
 */
export async function fetchUserLeaveDays(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('leave_days')
    .select('leave_date')
    .eq('user_id', userId);
  
  return new Set(data?.map(d => d.leave_date) || []);
}

// Update ExtendedValidationContext interface:
export interface ExtendedValidationContext {
  thresholds: Thresholds | null;
  holidays: Holiday[];
  workingDays: WorkingDaysConfig;
  activityTypes: string[];
  userLeaveDays?: Set<string>;  // Add this
}
```

**B. `src/lib/excelImportUtils.ts`** - Add leave validation:
```typescript
// In validateMemberExcelRow, after date normalization and before other validations:
if (validationContext?.userLeaveDays?.has(normalizedDate)) {
  errors.push(`Cannot create entries on leave days (${normalizedDate})`);
}
```

**C. `src/pages/BulkImport.tsx`** - Fetch and pass leave days:
```typescript
// After fetching validation context, also fetch leave days:
import { fetchUserLeaveDays } from "@/lib/thresholdValidation";

// In handleParseAndValidate:
const userLeaveDays = await fetchUserLeaveDays(targetUserId!);
const validationContextWithLeave = {
  ...validationContext,
  userLeaveDays,
};
```

---

### Issue 3: Remove Subject/Details Field

**Current State:**
The "Subject / Details (Optional)" field appears in:
- `src/pages/Timesheet.tsx` lines 844-852
- `src/pages/Calendar.tsx` lines 911-918

This field maps to `activitySubtype` state variable and saves to `activity_subtype` column.

**Solution:**
Remove the entire field block from both dialog forms. The `activitySubtype` state can remain (for backward compatibility if entries are edited) but the input field should be removed.

**File Changes:**

**A. `src/pages/Timesheet.tsx`** - Remove lines 844-852:
```diff
-                  <div className="space-y-2">
-                    <Label htmlFor="subtype">Subject / Details (Optional)</Label>
-                    <Input
-                      id="subtype"
-                      placeholder="e.g., Mathematics, Physics Lab"
-                      value={activitySubtype}
-                      onChange={(e) => setActivitySubtype(e.target.value)}
-                    />
-                  </div>
```

**B. `src/pages/Calendar.tsx`** - Remove lines 911-918:
```diff
-                <div className="space-y-2">
-                  <Label htmlFor="subtype">Subject / Details (Optional)</Label>
-                  <Input
-                    id="subtype"
-                    placeholder="e.g., Mathematics, Physics Lab"
-                    value={activitySubtype}
-                    onChange={(e) => setActivitySubtype(e.target.value)}
-                  />
-                </div>
```

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `src/pages/Reports.tsx` | Add `align="end" className="z-50"` to DropdownMenuContent for export |
| `src/lib/thresholdValidation.ts` | Add `fetchUserLeaveDays` function, update `ExtendedValidationContext` interface |
| `src/lib/excelImportUtils.ts` | Add leave day validation to `validateMemberExcelRow` and `validateAdminExcelRow` |
| `src/pages/BulkImport.tsx` | Fetch user leave days and pass to validation context |
| `src/pages/Timesheet.tsx` | Remove "Subject / Details (Optional)" field (lines 844-852) |
| `src/pages/Calendar.tsx` | Remove "Subject / Details (Optional)" field (lines 911-918) |

---

### Testing Checklist

- [ ] As L2/L3/Admin, go to Reports > Department View with data - Export button should be clickable
- [ ] Click Export > CSV - file should download
- [ ] Click Export > PDF - file should download  
- [ ] Member View export should still work
- [ ] Mark leave for a date, then try bulk upload with entry for that date - should fail validation
- [ ] Bulk upload with entries on working days (no leave) - should succeed
- [ ] Open New Entry dialog on Timesheet page - Subject/Details field should be gone
- [ ] Open New Entry dialog on Calendar page - Subject/Details field should be gone
- [ ] Submit timesheet entry without Subject/Details - should work normally
