
## Plan: Timesheet Bulk Upload & Dialog Improvements

### Overview
This plan addresses three interconnected changes to the Timesheet functionality:
1. **Google Drive Template Download** - Replace local template generation with Google Drive file download
2. **Enhanced Bulk Upload Validation** - Add working days, holidays, and activity type validation
3. **Scrollable Dialog Boxes** - Fix dialog UX so all fields and buttons are accessible

---

### Change 1: Google Drive Template Download

**Current State:**
- The `handleDownloadTemplate` function in `BulkImport.tsx` generates Excel templates locally using the `xlsx` library
- Templates are created in-memory and downloaded as blobs

**New Behavior:**
- When user clicks "Download Excel Template", redirect to Google Drive export URL
- The user receives a downloaded copy of the Google Sheet (not the original editable file)
- Only the first sheet matters for data/validation (extra tabs are ignored - this is already handled)

**Technical Approach:**
Google Sheets can be downloaded directly using a special export URL format:
```
https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=xlsx
```

For the provided link, the spreadsheet ID is: `1Z7478M5CrtU0LCIzbyQ_BmCqd6u5JgRk`

**File Changes:**

`src/pages/BulkImport.tsx`:
- Update `handleDownloadTemplate` to open the Google Drive export link
- Remove dependency on local template generation for member/manager mode

```typescript
const handleDownloadTemplate = () => {
  // Google Drive export URL - automatically downloads a copy
  const SPREADSHEET_ID = "1Z7478M5CrtU0LCIzbyQ_BmCqd6u5JgRk";
  const exportUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;
  
  // Open in new tab to trigger download
  window.open(exportUrl, "_blank");
};
```

---

### Change 2: Enhanced Bulk Upload Validation

**Current State:**
The validation in `excelImportUtils.ts` currently checks:
- Required fields (date, times, activity_type, department_code)
- Date format (DD/MM/YYYY or YYYY-MM-DD)
- Time format (HH:MM 24-hour)
- Activity type (hardcoded list: class, quiz, invigilation, admin, other)
- Department/vertical code exists
- User belongs to that department
- Work hour window thresholds

**Missing Validations:**
1. **Working Days** - Entries on non-working days (e.g., Saturday/Sunday if configured)
2. **Holidays** - Entries on configured holidays should be rejected
3. **Dynamic Activity Types** - Should validate against org's `activity_categories` table, not a hardcoded list

**Technical Approach:**

**A. Extend `thresholdValidation.ts`** to also fetch and validate:
- Working days configuration from `working_days` table
- Holidays from `holidays` table

Add new functions:
```typescript
interface ExtendedValidationContext {
  thresholds: Thresholds | null;
  holidays: { holiday_date: string; name: string }[];
  workingDays: WorkingDaysConfig;
  activityTypes: string[]; // Valid activity codes from activity_categories
}

async function fetchExtendedValidationContext(userId: string): Promise<ExtendedValidationContext>

function validateEntryDateAgainstHolidaysAndWorkingDays(
  entryDate: string, 
  holidays: { holiday_date: string; name: string }[], 
  workingDays: WorkingDaysConfig
): { valid: boolean; error?: string }
```

**B. Update `excelImportUtils.ts`**:
- Pass extended validation context to `validateMemberExcelRow` and `validateAdminExcelRow`
- Add holiday check: if `entry_date` matches any holiday, reject with error
- Add working day check: if `entry_date` falls on a non-working day, reject with error
- Replace hardcoded activity type list with dynamic validation against fetched activity categories

**C. Update `BulkImport.tsx`**:
- Fetch the extended validation context before processing rows
- Pass all validation data (thresholds, holidays, working days, activity types) to validation functions

**File Changes:**

`src/lib/thresholdValidation.ts`:
- Add `WorkingDaysConfig` interface
- Add `fetchExtendedValidationContext` function
- Add `validateDateAgainstHolidaysAndWorkingDays` function

`src/lib/excelImportUtils.ts`:
- Update `validateMemberExcelRow` signature to accept extended context
- Update `validateAdminExcelRow` signature to accept extended context  
- Add holiday validation logic
- Add working day validation logic
- Replace hardcoded activity types with dynamic validation

`src/pages/BulkImport.tsx`:
- Import and call `fetchExtendedValidationContext`
- Pass all validation data to row validation functions

---

### Change 3: Scrollable Dialog Boxes

**Problem:**
The "Add Timesheet Entry" dialogs in `Timesheet.tsx` and `Calendar.tsx` have many form fields (date, times, activity type, vertical, program, batch, term, subject, notes, buttons). On smaller screens or when many programs/batches are available, the dialog content overflows and the submit button becomes inaccessible.

**Solution:**
Add scroll capability to the DialogContent by:
1. Setting a maximum height on the dialog content
2. Adding `overflow-y-auto` to allow scrolling
3. Ensuring the header stays fixed and the form area scrolls

**Technical Approach:**

Update the `DialogContent` wrapper in both files to include:
- `max-h-[90vh]` - Limit height to 90% of viewport height
- `overflow-y-auto` - Enable vertical scrolling
- Wrap the form fields in a `ScrollArea` component for better UX

**File Changes:**

`src/pages/Timesheet.tsx` (lines 759-984):
```tsx
<DialogContent className="max-w-md max-h-[90vh] flex flex-col">
  <DialogHeader className="flex-shrink-0">
    {/* Header stays fixed */}
  </DialogHeader>
  <ScrollArea className="flex-1 overflow-y-auto pr-4">
    <div className="space-y-4">
      {/* All form fields */}
    </div>
  </ScrollArea>
  <div className="flex gap-2 flex-shrink-0 pt-4 border-t">
    {/* Buttons stay visible at bottom */}
  </div>
</DialogContent>
```

`src/pages/Calendar.tsx` (lines 861-1048):
- Same pattern as Timesheet.tsx

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `src/lib/thresholdValidation.ts` | Add WorkingDaysConfig, holiday/working day validation functions, fetchExtendedValidationContext |
| `src/lib/excelImportUtils.ts` | Update validateMemberExcelRow and validateAdminExcelRow to check holidays, working days, and dynamic activity types |
| `src/pages/BulkImport.tsx` | Replace local template with Google Drive download, fetch extended validation context |
| `src/pages/Timesheet.tsx` | Add ScrollArea and max-height to dialog, restructure for fixed header/footer |
| `src/pages/Calendar.tsx` | Same dialog scroll improvements as Timesheet.tsx |

---

### Technical Details

**Google Drive Export URL:**
- Format: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=xlsx`
- This automatically triggers a download of a copy - the original file is not modified
- Users receive the same template with dropdown functionality preserved

**Holiday Validation Logic:**
```typescript
function isHolidayDate(dateStr: string, holidays: Holiday[]): Holiday | null {
  return holidays.find(h => h.holiday_date === dateStr) || null;
}

// In validation:
const holiday = isHolidayDate(normalizedDate, holidays);
if (holiday) {
  errors.push(`Cannot create entries on holidays (${holiday.name})`);
}
```

**Working Day Validation Logic:**
```typescript
function isWorkingDayDate(dateStr: string, workingDays: WorkingDaysConfig): boolean {
  const date = new Date(dateStr);
  const dayIndex = date.getDay(); // 0=Sun, 1=Mon, ...
  const dayMap = { 0: 'sunday', 1: 'monday', ... };
  return workingDays[dayMap[dayIndex]];
}

// In validation:
if (!isWorkingDayDate(normalizedDate, workingDays)) {
  errors.push("Cannot create entries on non-working days");
}
```

**Activity Type Validation:**
```typescript
// Fetch from activity_categories table
const activityCodes = await fetchOrgActivityCodes(organizationId);

// In validation:
const activityCodeLower = row.activity_type.toLowerCase();
if (!activityCodes.includes(activityCodeLower)) {
  errors.push(`Invalid activity type '${row.activity_type}'. Valid types: ${activityCodes.join(', ')}`);
}
```

---

### Testing Checklist

- [x] Download template from Google Drive - verify xlsx downloads correctly with dropdowns
- [ ] Upload file with entry on a holiday date - should fail validation
- [ ] Upload file with entry on a non-working day (e.g., Sunday) - should fail validation
- [ ] Upload file with invalid activity type - should fail with list of valid types
- [ ] Upload file with entry outside work hour window - should fail validation
- [ ] Upload file with valid entries - should pass and import successfully
- [x] Open New Entry dialog on Timesheet page - verify scrolling works
- [x] Open New Entry dialog on Calendar page - verify scrolling works
- [x] Submit button should always be visible in dialogs

### Implementation Status: ✅ Complete
