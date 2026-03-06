

## Root Cause Analysis: Intermittent Blank Dropdowns and Dead Submit Button

### The Core Problem: Auth Token Refresh Destabilizes the Entire Page

Every Supabase token refresh (happens automatically every ~60 minutes, or on tab focus) triggers `onAuthStateChange` → `getUserWithRole()` → `setUserWithRole(newObject)`. Even though the data is identical, React sees a **new object reference**, causing every component and hook that depends on `userWithRole` to re-execute.

This creates three cascading failures:

**Issue 1a — Activity dropdown goes blank:**
`useActivityCategories` has `useEffect(() => { loadCategories() }, [userWithRole])`. On token refresh, this re-runs `loadCategories()` which calls `setLoading(true)`. During that brief window, `loading` is `true`. But more critically: the RLS policy for `activity_categories` calls `get_user_organization(auth.uid())`. If the query fires during the millisecond window between the old token being invalidated and the new one being applied, the RLS function can return `null`, making the query return **0 rows**. The code falls back to hardcoded defaults with codes like `"class"`, `"quiz"`. If the user previously selected a DB-derived code (e.g., `"teaching/lecture"` → `"teaching/lecture"`), the selected value no longer matches any option — dropdown appears blank.

**Issue 1c — Program dropdown goes blank:**
`fetchUserPrograms()` at line 583 has the guard: `if (!userWithRole || !verticalId) { setPrograms([]); return; }`. If this function is called (or re-rendered) while `userWithRole` is momentarily `null` during token refresh, it **actively clears** the programs array. The dropdown goes blank. Since `programs` is local state (not re-fetched automatically), it stays blank until the user re-selects a vertical.

**Issue 1b — Submit button stops working:**
`handleSubmit` at line 228 checks `if (!userWithRole?.user?.id)`. During token refresh, `userWithRole` can be `null` for a brief moment. If the user clicks Submit during that window, the function returns early with an error toast. But the toast can be missed if it appears and disappears quickly, making it seem like the button "does nothing."

### Why It's Random
Token refreshes happen based on token expiry timing (not user action). Different users have different login times, so their tokens expire at different times. Tab-focus events also trigger session checks. This explains "random users, random times."

### Fix Plan

**File: `src/hooks/useActivityCategories.ts`**

Stop re-fetching on every `userWithRole` reference change. Instead:
- Track whether initial load has completed with a ref
- Only depend on `userWithRole` being truthy (not its reference)
- Remove the re-fetch-on-every-change pattern

```typescript
// Change from:
useEffect(() => {
  if (!userWithRole) return;
  loadCategories();
}, [userWithRole]);

// Change to:
const hasFetchedRef = useRef(false);
useEffect(() => {
  if (!userWithRole || hasFetchedRef.current) return;
  hasFetchedRef.current = true;
  loadCategories();
}, [userWithRole]);
```

**File: `src/pages/Timesheet.tsx`**

Three targeted fixes:

1. **Stabilize `fetchUserPrograms` guard** — Use a ref for `userWithRole` so the function never sees a stale `null` during token refresh:
```typescript
const userRef = useRef(userWithRole);
useEffect(() => { userRef.current = userWithRole; }, [userWithRole]);

// In fetchUserPrograms:
const currentUser = userRef.current;
if (!currentUser || !verticalId) { ... }
```

2. **Stabilize `handleSubmit` guard** — Same ref pattern for the submit handler so it never reads a momentarily-null `userWithRole`.

3. **Stabilize initial data load** — Change the `useEffect` that loads entries/verticals to use a "loaded" ref so it only runs once, not on every `userWithRole` reference change:
```typescript
const hasLoadedRef = useRef(false);
useEffect(() => {
  if (!userWithRole || hasLoadedRef.current) return;
  // ... role check and navigate
  hasLoadedRef.current = true;
  loadEntries();
  loadLeaveDays();
  loadUserVerticals();
}, [userWithRole]);
```

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/useActivityCategories.ts` | Fetch once on auth ready, not on every reference change |
| `src/pages/Timesheet.tsx` | Use refs for `userWithRole` in async handlers; load data once not on every re-render |

### What Stays the Same
- Auth flow, token refresh logic — unchanged
- Database, RLS policies — unchanged
- All other pages — unchanged
- Bulk upload, approvals — unchanged
- The `refetch` function on the hook remains available for manual refresh if needed

