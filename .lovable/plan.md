

## Plan: Strict Threshold Enforcement and Cross-Method Overlap Detection

### Overview
Two related timesheet validation fixes:
1. **Strict threshold enforcement** -- work hour window and max daily hours must block entries outside configured limits
2. **Cross-method overlap detection** -- prevent duplicate/overlapping entries between manual and bulk upload

---

### Issue 1: Threshold Validation Not Blocking Entries

**Root Cause:**
The `useThresholds` hook (used by Timesheet.tsx for individual entries) uses `.single()` when querying thresholds and working days. If no row exists (or multiple rows exist), `.single()` returns an error and `data` becomes `null`. The hook then silently falls back to `defaultThresholds` which has `work_hours_enabled: false` and `max_hours_enabled: false`, effectively disabling all threshold checks.

Additionally, there is a timing risk: when the user selects a vertical, the hook re-fetches thresholds asynchronously. If the user submits before the fetch completes, stale (disabled) thresholds are used.

**Fix:**

**A. `src/hooks/useThresholds.ts`** -- Change all `.single()` calls to `.maybeSingle()`:
- Line ~101: `fetchThresholds` vertical-specific query
- Line ~114: `fetchThresholds` org-wide query  
- Line ~137: `fetchWorkingDays` vertical-specific query
- Line ~150: `fetchWorkingDays` org-wide query

This prevents silent failures when no rows or multiple rows exist.

**B. `src/pages/Timesheet.tsx`** -- Add a direct DB threshold check in `handleSubmit` as a safety net:
Before the existing threshold validation block (lines 302-321), fetch thresholds fresh from DB using `fetchOrgThresholds` or `fetchUserThresholds` from `thresholdValidation.ts`. This ensures the validation always uses the latest threshold data, regardless of hook loading state.

```typescript
// Fetch fresh thresholds from DB to ensure latest settings
const freshThresholds = await fetchUserThresholds(userWithRole.user.id);
if (freshThresholds) {
  const thresholdResult = validateAgainstThresholds(normalizedStart, normalizedEnd, freshThresholds);
  if (!thresholdResult.valid) {
    toast({ title: "Threshold Exceeded", description: thresholdResult.error, variant: "destructive" });
    return;
  }
  
  // Also check max hours with fresh thresholds
  if (freshThresholds.max_hours_enabled) {
    // ... calculate total minutes including existing entries ...
  }
}
```

This replaces (or supplements) the existing hook-based validation to guarantee fresh data.

---

### Issue 2: Cross-Method Overlap Detection (Manual vs Bulk)

**Current State:**
- Manual entry (Timesheet.tsx): Checks overlaps against locally loaded `entries` array -- works within the same session
- Bulk upload (excelImportUtils.ts): Zero overlap checking -- neither against existing DB entries nor between rows in the same upload

**Fix:**

**A. `src/pages/BulkImport.tsx`** -- Fetch existing entries before validation:
After determining `targetUserId`, fetch all non-rejected timesheet entries from DB for that user. Pass them to the validation function.

```typescript
// Fetch existing entries for overlap checking
const { data: existingEntries } = await supabase
  .from("timesheet_entries")
  .select("entry_date, start_time, end_time")
  .eq("user_id", targetUserId)
  .neq("status", "rejected");
```

**B. `src/lib/excelImportUtils.ts`** -- Add overlap checking in `validateMemberExcelRow`:
Accept an `existingEntries` parameter. For each row, check if the time range overlaps with any existing DB entry on the same date.

```typescript
// Check overlap with existing DB entries
if (existingEntries) {
  const sameDate = existingEntries.filter(e => e.entry_date === normalizedDate);
  for (const existing of sameDate) {
    if (timesOverlap(row.start_time, row.end_time, existing.start_time, existing.end_time)) {
      errors.push(`Time ${row.start_time}-${row.end_time} overlaps with existing entry ${existing.start_time}-${existing.end_time}`);
      break;
    }
  }
}
```

**C. Intra-upload overlap detection** -- In BulkImport.tsx, after all rows are validated, check valid rows against each other for same-date overlaps. Mark duplicates as invalid.

**D. Max hours per day in bulk upload** -- The current `validateAgainstThresholds` only checks the single entry against the work window. Add cumulative daily hours checking in bulk upload:
- Sum existing DB entries for each date
- Sum other bulk rows for same date
- Ensure total doesn't exceed `max_hours_minutes`

---

### Summary of File Changes

| File | Changes |
|------|---------|
| `src/hooks/useThresholds.ts` | Replace `.single()` with `.maybeSingle()` in 4 places to prevent silent threshold loading failures |
| `src/pages/Timesheet.tsx` | Add fresh DB threshold fetch in `handleSubmit` as safety net, plus max hours check with fresh data |
| `src/lib/excelImportUtils.ts` | Add `existingEntries` parameter to `validateMemberExcelRow`; add overlap checking; add `timesOverlap` helper function |
| `src/pages/BulkImport.tsx` | Fetch existing entries from DB before validation; pass to validator; add intra-upload overlap and cumulative daily hours checks after validation |

---

### Technical Details

**Overlap detection helper:**
```typescript
function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return toMin(startA) < toMin(endB) && toMin(endA) > toMin(startB);
}
```

**Cumulative max hours check in bulk upload:**
```typescript
// For each date, sum: existing DB minutes + all valid bulk rows for same date
// If total exceeds max_hours_minutes, mark excess rows as invalid
```

---

### Testing Checklist

**Threshold enforcement:**
- [ ] Set work hours to 8:30-17:30 in Admin Settings
- [ ] Try manual entry with 17:30-19:00 -- should be blocked
- [ ] Try bulk upload with 17:30-19:00 -- should be blocked
- [ ] Set max hours to 8h, add entries totaling 7h, then try adding 2h more -- should be blocked

**Overlap detection:**
- [ ] Create manual entry 9:00-10:00, then bulk upload 9:30-10:30 for same date -- should be blocked
- [ ] Bulk upload 9:00-10:00, then try manual entry 9:30-10:30 -- should be blocked (already works via local state reload)
- [ ] Bulk upload two rows with overlapping times on same date -- should be blocked

