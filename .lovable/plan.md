
## Plan: Fix Bulk Upload New Columns, Future Date Validation, and Email Visibility

### Overview
This plan addresses three separate issues:
1. **Bulk Upload Excel New Columns** - Add support for Batch, Program, Subject columns (E, F, G) with department_code moved to column I
2. **Future Date Validation** - Block manual entry of future dates in timesheet forms
3. **Admin Email Visibility** - Fix missing emails in the Users list

---

### Issue 1: Bulk Upload Excel - New Column Structure

**Current State:**
- The Excel template has columns: `entry_date`, `start_time`, `end_time`, `activity_type`, `activity_subtype`, `notes`, `department_code`
- The parsing uses `sheet_to_json` which reads header names directly
- The validation only checks department_code

**New Excel Structure (from Google Drive):**
Based on the user's description, the new columns are:
- Column A: entry_date
- Column B: start_time  
- Column C: end_time
- Column D: activity_type
- Column E: batch (optional)
- Column F: program (required)
- Column G: subject (optional)
- Column H: notes
- Column I: department_code (vertical - required)

**Required Changes:**

**A. Update `ExcelRowBase` interface** in `src/lib/excelImportUtils.ts`:
```typescript
interface ExcelRowBase {
  entry_date: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  batch?: string;           // NEW - optional
  program: string;          // NEW - required (code)
  subject?: string;         // NEW - optional
  notes?: string;
  department_code: string;  // vertical code
  activity_subtype?: string; // backward compatibility
}
```

**B. Update `validateMemberExcelRow`** to:
1. Validate `program` is required and non-empty
2. Validate the user is assigned to that program under the selected vertical
3. `batch` and `subject` are optional - no validation needed
4. Include program_id, batch_name, subject_code in the returned data

**C. Update `validateAdminExcelRow`** similarly

**D. Update data insertion** to include:
- `program_id` (lookup from program code + vertical)
- `batch_name` (if provided)
- `subject_code` (if provided)

**E. Add helper function** to fetch user programs:
```typescript
async function fetchUserPrograms(userId: string): Promise<Map<string, { id: string; vertical_id: string }>>
```

---

### Issue 2: Future Date Validation

**Current State:**
- In `Timesheet.tsx` line 782-783: The date input has `max={new Date().toISOString().split("T")[0]}` which limits the picker
- However, users can manually TYPE a future date bypassing this restriction
- No server-side validation exists to block future dates

**Required Changes:**

**A. `src/pages/Timesheet.tsx` - Add validation in `handleSubmit`** (around line 225):
```typescript
// After leave day check, before overlap check:
const today = new Date();
const todayStr = today.toISOString().split("T")[0];
if (entryDate > todayStr) {
  toast({
    title: "Future Date Not Allowed",
    description: "Cannot create timesheet entries for future dates",
    variant: "destructive",
  });
  return;
}
```

**B. `src/pages/Calendar.tsx` - Already handles this:**
Calendar uses `selectedDate` from day click, which already has `if (day > new Date()) return;` check at line 233.

**C. `src/lib/excelImportUtils.ts` - Add future date validation** in both `validateMemberExcelRow` and `validateAdminExcelRow`:
```typescript
// After normalizing date, check if it's in the future:
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
if (normalizedDate > todayStr) {
  errors.push(`Cannot create entries for future dates (${normalizedDate})`);
}
```

---

### Issue 3: Admin Email Visibility

**Current State:**
- `admin-list-users` edge function returns all users with emails
- `Users.tsx` line 202-206 calls this and maps emails to profile IDs
- Looking at the image, some users have emails visible and some don't

**Root Cause Analysis:**
The edge function at line 63 calls `supabase.auth.admin.listUsers()` which has a default limit of 1000. If there are more than 1000 users, some may be missing.

However, looking more closely:
- The `emailMap` is built from `authUsers` (line 222)
- Each user profile checks `emailMap.get(profile.id)` at line 294
- If the user was created via `admin.createUser()`, their auth record exists

Most likely cause: **Pagination issue** - the `listUsers` API returns paginated results (default 50-1000), and we're only fetching the first page.

**Fix in `supabase/functions/admin-list-users/index.ts`:**
```typescript
// Replace single listUsers call with paginated fetch
let allUsers: any[] = [];
let page = 1;
const perPage = 1000;

while (true) {
  const { data: { users }, error } = await supabaseClient.auth.admin.listUsers({
    page,
    perPage,
  });
  
  if (error) throw error;
  
  allUsers = [...allUsers, ...users];
  
  if (users.length < perPage) break; // No more pages
  page++;
}

let filteredUsers = allUsers;
// ... rest of filtering logic
```

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `src/lib/excelImportUtils.ts` | Add batch, program, subject fields to interface; validate program required; lookup program_id; add future date validation |
| `src/pages/Timesheet.tsx` | Add future date validation check before submission |
| `src/pages/BulkImport.tsx` | Fetch user's programs for validation; pass program data to validators |
| `supabase/functions/admin-list-users/index.ts` | Implement pagination to fetch all users |

---

### Technical Details

**Program Validation Logic:**
```typescript
// 1. Fetch user's assigned programs
const { data: userProgs } = await supabase
  .from("user_programs")
  .select("program_id")
  .eq("user_id", targetUserId);

// 2. Fetch program details (id, code, vertical_id)
const { data: programs } = await supabase
  .from("programs")
  .select("id, code, vertical_id")
  .in("id", userProgs.map(p => p.program_id));

// 3. Build validation map: programCode -> { id, vertical_id }
const userProgramsMap = new Map(programs.map(p => [p.code.toUpperCase(), { id: p.id, vertical_id: p.vertical_id }]));

// 4. In validation:
const programCodeUpper = row.program.toUpperCase();
const programInfo = userProgramsMap.get(programCodeUpper);
if (!programInfo) {
  errors.push(`You are not assigned to program '${row.program}'`);
}
// Optionally check program belongs to selected vertical
if (programInfo && deptId !== programInfo.vertical_id) {
  errors.push(`Program '${row.program}' does not belong to vertical '${row.department_code}'`);
}
```

**Future Date Check (using local date components to avoid timezone issues):**
```typescript
function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// In validation:
if (normalizedDate > getTodayDateString()) {
  errors.push("Cannot create entries for future dates");
}
```

---

### Testing Checklist

**Bulk Upload:**
- [ ] Upload file with valid batch, program, subject columns - should import successfully
- [ ] Upload file with missing program - should fail validation with "program is required"
- [ ] Upload file with program user is not assigned to - should fail with appropriate error
- [ ] Upload file with valid department but program not in that vertical - should fail
- [ ] Verify imported entries show program/batch/subject in timesheets and approvals

**Future Date Validation:**
- [ ] In Timesheet.tsx dialog, manually type a future date like "2026-12-31" and submit - should show error
- [ ] In bulk upload, include row with future date - should fail validation
- [ ] Leave application for future date - should still work (exception)

**Email Visibility:**
- [ ] As admin, go to Users page - all users should show their emails
- [ ] Click on any user name - email should appear in the detail popup
- [ ] Verify no users have missing email in the list

