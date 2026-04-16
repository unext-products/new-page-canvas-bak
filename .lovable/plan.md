

# Add CSV Download to Hierarchy Pages

## Summary
Add a "Download" button (matching the User Management page style) to Verticals, Programs, Batches, Terms, and Subjects pages. Each will export the currently displayed data as a CSV file.

## Changes

### All 5 pages follow the same pattern:
1. Import `Download` from lucide-react and `format` from date-fns
2. Add a `downloadCSV` function that converts the page's data array to CSV
3. Add a `Download` button in the `PageHeader` `actions` prop, next to the existing "Add" button

### CSV columns per page:

- **Verticals** (`src/pages/Verticals.tsx`): Name, Code, Programs Count, Users Count
- **Programs** (`src/pages/Programs.tsx`): Name, Code, Vertical, Users Count
- **Batches** (`src/pages/Batches.tsx`): Name, Program, Vertical, Terms Count, Users Count
- **Terms** (`src/pages/Terms.tsx`): Name, Batch, Program, Vertical, Subjects Count
- **Subjects** (`src/pages/Subjects.tsx`): Name, Code, Term, Batch, Program, Vertical, Users Count

### Implementation detail per page:
- The download function creates CSV content from the existing state arrays (`verticals`, `programs`, `filteredBatches`, `filteredTerms`, `filteredSubjects`)
- Uses the same CSV blob + anchor download pattern as Users page
- File named `{entity}_{date}.csv` (e.g., `verticals_2026-04-16.csv`)
- The Download button uses `variant="outline"` matching the Users page style

### Files changed
- `src/pages/Verticals.tsx`
- `src/pages/Programs.tsx`
- `src/pages/Batches.tsx`
- `src/pages/Terms.tsx`
- `src/pages/Subjects.tsx`

