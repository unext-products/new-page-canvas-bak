
## Goal

Replace the current "download uploaded sample file" flow with an **auto-generated Excel template** that dynamically includes the user's role-scoped activity categories as a dropdown (data validation) in the Activity Type column. This removes the admin's burden of re-uploading sample files whenever categories change.

## How It Works

1. When a user clicks **"Download Excel Template"** on the Bulk Import page, the system generates an `.xlsx` file on the fly using the `xlsx` library (already installed).
2. The generated file has **two sheets**:
   - **Sheet 1 ("Timesheet")**: The 9-column template matching the existing structure (Entry Date, Start Time, End Time, Activity Type, Batch, Program, Subject, Notes, Department Code). Activity Type column cells use Excel **Data Validation** (list type) referencing the values on Sheet 2.
   - **Sheet 2 ("Activity Types")**: A hidden/reference sheet listing all active activity categories filtered by the user's role scope (`l1`, `l2`, or `l3`). For hierarchical categories (parent > child), it lists the selectable leaf-node names.
3. The Activity Type column uses Excel data validation so users can **only select from the dropdown**, not type freely.

## Columns

The template columns remain exactly as they are today — no new columns added:
- A: Entry Date
- B: Start Time
- C: End Time
- D: Activity Type (dropdown from Sheet 2)
- E: Batch (optional)
- F: Program
- G: Subject (optional)
- H: Notes
- I: Department Code

For admin bulk import, Column A becomes "Faculty Email" and the rest shift accordingly (existing 8-column admin format).

## Technical Changes

### 1. New utility: `src/lib/generateSampleTimesheet.ts`

- Export `generateSampleTimesheetBlob(categories: ActivityCategory[], isAdmin: boolean): Blob`
- Creates workbook with two sheets
- Sheet 1: sample row(s) with column headers matching the expected import format
- Sheet 2: "Activity Types" — one column listing category names
- Apply `XLSX` data validation on the Activity Type column cells (rows 2–100) referencing `'Activity Types'!$A$2:$A$N`
- Note: `xlsx` (SheetJS community edition) has limited data validation support. We'll use the `xlsx-populate` or raw XML approach if needed, or switch to using `exceljs` which natively supports data validation. **Decision: use `exceljs`** (add as dependency) since it has first-class support for dropdown data validation.

### 2. Update `src/pages/BulkImport.tsx`

- In `handleDownloadTemplate`:
  - Fetch activity categories for the user's org filtered by role scope (reuse logic from `useActivityCategories`)
  - Call `generateSampleTimesheetBlob(filteredCategories, isAdmin)` to create the file
  - Download the blob
  - Remove the storage-based sample download and Google Sheets fallback entirely (or keep as secondary fallback — TBD based on preference)

### 3. Settings page (`SampleTimesheetUpload` component)

- This component can remain for admins who want to upload custom samples with pre-filled example data, but the auto-generated template becomes the **primary** download path. Optionally, we can add a note saying templates are now auto-generated.

### 4. Dependency

- Add `exceljs` package — it supports Excel data validation (dropdown lists) natively, unlike `xlsx` (SheetJS).

## What stays the same

- The 9-column (member) / 8-column (admin) structure — no changes
- Import/validation logic — untouched
- Category management in Settings — untouched
