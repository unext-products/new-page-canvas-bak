

## Plan: Fix Department Report Export and Add Edit Pending Entries Feature

### Issue 1: Department View Report Export Not Working

**Root Cause Identified:**
The `VerticalReportData` interface (in `reportQueries.ts`) returns `verticalName` as the property name, but both export functions reference `report.departmentName` which is `undefined`. When `undefined.replace()` is called (for the filename), it throws a runtime error, silently preventing the download.

Specific locations:
- `exportUtils.ts` line 215: `report.departmentName` (should be `report.verticalName`)
- `exportUtils.ts` line 259: `report.departmentName.replace(...)` (crashes here)
- `pdfExportUtils.ts` line 205: `report.departmentName` (undefined)
- `pdfExportUtils.ts` line 274: `report.departmentName.replace(...)` (crashes here)

**Fix:**
Replace all `report.departmentName` references with `report.verticalName` in both export files. This is a straightforward property name mismatch -- the data model was renamed from "department" to "vertical" but the export functions were never updated.

**Files to change:**
- `src/lib/exportUtils.ts` -- 2 occurrences of `report.departmentName` to `report.verticalName`
- `src/lib/pdfExportUtils.ts` -- 2 occurrences of `report.departmentName` to `report.verticalName`

---

### Feature 2: Edit Pending Timesheet Entries

**Current State:**
- Users see a list of their entries in `Timesheet.tsx` (lines 1014-1065)
- For draft/submitted entries, there is only a Delete button (Trash2 icon)
- The "New Entry" dialog already has all form fields and submission logic

**Implementation Approach:**

Add an "Edit" button next to the Delete button for pending entries. When clicked, it opens the same dialog pre-filled with the entry's data. On submit, it performs an UPDATE instead of an INSERT.

**Detailed Changes in `src/pages/Timesheet.tsx`:**

1. **Add edit state variable:**
   ```typescript
   const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
   ```

2. **Add `Pencil` icon import** from lucide-react

3. **Create `handleEdit` function** that:
   - Sets `editingEntryId` to the entry's ID
   - Pre-fills all form fields from the entry data (date, times, activity type, vertical, program, batch, term, subject, notes)
   - Triggers cascading dropdown loads (fetchUserPrograms, fetchBatches, fetchTerms, fetchSubjects) so the selectors are populated
   - Opens the dialog

4. **Modify `handleSubmit`** to check `editingEntryId`:
   - If `editingEntryId` is set, use `supabase.from("timesheet_entries").update({...}).eq("id", editingEntryId)` instead of `.insert({...})`
   - Pass `editingEntryId` to `checkTimeOverlap` to exclude the current entry from overlap checks (already supported via the `excludeId` parameter at line 195)

5. **Modify `resetForm`** to also clear `editingEntryId`

6. **Update dialog title** to show "Edit Timesheet Entry" when editing, "Add Timesheet Entry" when creating

7. **Add Edit button** in the entry list (lines 1055-1064), alongside the existing Delete button:
   ```tsx
   {(item.status === "draft" || item.status === "submitted") && (
     <div className="flex gap-1">
       <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} title="Edit entry">
         <Pencil className="h-4 w-4" />
       </Button>
       <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} title="Delete entry">
         <Trash2 className="h-4 w-4" />
       </Button>
     </div>
   )}
   ```

**Files to change:**
- `src/pages/Timesheet.tsx` -- Add edit state, handleEdit function, modify handleSubmit for update, add Edit button in entry list

---

### Summary of All File Changes

| File | Change | Issue |
|------|--------|-------|
| `src/lib/exportUtils.ts` | Replace `report.departmentName` with `report.verticalName` (2 places) | #1 |
| `src/lib/pdfExportUtils.ts` | Replace `report.departmentName` with `report.verticalName` (2 places) | #1 |
| `src/pages/Timesheet.tsx` | Add editingEntryId state, handleEdit function, update handleSubmit for edit mode, add Pencil button | #2 |

