
## Plan: Fix Department Report Export and Bulk Upload Validation

### Overview
This plan addresses two separate issues:
1. **Department View Export Not Clickable** - Export dropdown items are visible but clicks don't work
2. **Bulk Upload Validation Bug** - Program validation fails despite correct data entry

---

### Issue 1: Department View Export Not Clickable

**Root Cause Analysis:**
Looking at the Reports.tsx code (lines 269-281), the DropdownMenu already has `align="end"` and `className="z-50"` on DropdownMenuContent. The component uses Portal (already wrapped in dropdown-menu.tsx line 59).

The issue is that the DropdownMenuItem in Radix UI by default uses `cursor-default` (line 82 in dropdown-menu.tsx). When the button is in a PageHeader which may have flex/overflow properties, the clickable area may be compromised.

**Solution:**
Add explicit `cursor-pointer` class to DropdownMenuItem elements to ensure clickability, and ensure the dropdown menu has higher z-index to prevent any overlapping issues:

**File: `src/pages/Reports.tsx`**
```diff
- <DropdownMenuContent align="end" className="z-50">
-   <DropdownMenuItem onClick={handleExportCSV}>Export to CSV</DropdownMenuItem>
-   <DropdownMenuItem onClick={handleExportPDF}>Export to PDF</DropdownMenuItem>
+ <DropdownMenuContent align="end" className="z-[100]" sideOffset={8}>
+   <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">Export to CSV</DropdownMenuItem>
+   <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">Export to PDF</DropdownMenuItem>
</DropdownMenuContent>
```

---

### Issue 2: Bulk Upload Validation Bug

**Root Cause Analysis:**
Two issues identified:

**A. Header Case Mismatch:**
- Template headers: `Batch`, `Program`, `Subjects` (with capital letters)
- Code expects: `batch`, `program`, `subject` (lowercase)
- When XLSX parses, it uses exact header names as object keys
- `row.program` returns `undefined` because the key is actually `row.Program`

**B. Program Name vs Code:**
- User enters: `PGDBSO` (program name)
- Code validates against: `TMB01_26` (program code)
- The validation fails because it only looks up by code

**Solution:**

**File: `src/lib/excelImportUtils.ts`**

1. Add header normalization in `parseExcelFile()` to convert all keys to lowercase:
```typescript
const processedData = jsonData.map((row: any) => {
  // Normalize all keys to lowercase
  const normalizedRow: any = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[key.toLowerCase()] = value;
  }
  return {
    ...normalizedRow,
    // Handle "subjects" -> "subject" mapping
    subject: normalizedRow.subject || normalizedRow.subjects,
    start_time: normalizedRow.start_time !== undefined ? excelTimeToHHMM(normalizedRow.start_time) : undefined,
    end_time: normalizedRow.end_time !== undefined ? excelTimeToHHMM(normalizedRow.end_time) : undefined,
    entry_date: normalizedRow.entry_date !== undefined ? excelDateToString(normalizedRow.entry_date) : undefined,
  };
});
```

2. Modify program validation to accept BOTH program code AND program name in `validateMemberExcelRow()`:
```typescript
// Validate program - check by code first, then by name
let programId: string | null = null;
const programCodeUpper = row.program.toUpperCase();

if (userProgramsMap) {
  // Check if user is assigned to this program by code
  let programInfo = userProgramsMap.get(programCodeUpper);
  
  // If not found by code, try to find by name
  if (!programInfo) {
    for (const [code, info] of userProgramsMap.entries()) {
      if (info.name?.toUpperCase() === programCodeUpper) {
        programInfo = info;
        break;
      }
    }
  }
  
  if (!programInfo) {
    errors.push(`You are not assigned to program '${row.program}'`);
  } else if (deptId && programInfo.vertical_id !== deptId) {
    errors.push(`Program '${row.program}' does not belong to vertical '${row.department_code}'`);
  } else {
    programId = programInfo.id;
  }
}
```

3. Update the userProgramsMap to include program name:
**File: `src/pages/BulkImport.tsx`** (around line 287-291):
```typescript
// Fetch program details (code, name, and vertical_id)
const { data: progs } = await supabase
  .from("programs")
  .select("id, code, name, vertical_id")
  .in("id", userProgIds);

userProgramsMap = new Map(
  progs?.map((p) => [
    p.code.toUpperCase(),
    { id: p.id, vertical_id: p.vertical_id || "", name: p.name }
  ]) || []
);

// Also add by name for lookup flexibility
progs?.forEach((p) => {
  if (p.name) {
    userProgramsMap!.set(p.name.toUpperCase(), { id: p.id, vertical_id: p.vertical_id || "", name: p.name });
  }
});
```

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `src/pages/Reports.tsx` | Increase z-index to z-[100], add sideOffset, add cursor-pointer class to DropdownMenuItems |
| `src/lib/excelImportUtils.ts` | Normalize Excel headers to lowercase, handle "subjects" -> "subject" mapping, update program validation to accept name or code |
| `src/pages/BulkImport.tsx` | Include program name in userProgramsMap for dual lookup |

---

### Testing Checklist

**Department View Export:**
- [ ] Go to Reports > Department View with data
- [ ] Click Export button - dropdown should appear
- [ ] Click "Export to CSV" - file should download
- [ ] Click "Export to PDF" - file should download

**Bulk Upload Validation:**
- [ ] Upload file with "Program" header (capital P) - should parse correctly
- [ ] Enter program NAME (e.g., "PGDBSO") - should validate successfully
- [ ] Enter program CODE (e.g., "TMB01_26") - should validate successfully
- [ ] Enter wrong program name/code - should fail validation with clear error
- [ ] Upload with "Subjects" header - should map to "subject" field correctly
