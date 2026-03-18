

## Root Cause Analysis & Fix Plan

### Issue 1: Dashboard Completion Rate ignores leave days

**Root Cause**: `EnhancedCompletionCard.tsx` line 68-69 calculates working days using `getWorkingDaysInRange()` which only excludes weekends. It never fetches leave days, so for the week of Mar 9-13 with 2 leave days, it counts 5 working days (expected = 40h) instead of 3 (expected = 24h).

**Fix**: In `fetchCompletionData()`, fetch leave days for the date range, compute leave weight (0.5 for half-day, 1.0 for full-day), and subtract from working days count. Also use the user's resolved daily target instead of hardcoded 480 minutes.

**File**: `src/components/dashboard/EnhancedCompletionCard.tsx`

---

### Issue 2: Member Report fails to generate (error toast)

**Root Cause**: `countWorkingDays()` in `reportQueries.ts` line 456 uses `require("@/lib/leaveUtils")` — a CommonJS call inside an ESM/Vite project. This crashes at runtime in the browser, causing `fetchFacultyReport()` to throw, which surfaces as the "Failed to complete generate report" error.

**Fix**: Replace `require()` with a static ES module `import` at the top of `reportQueries.ts`:
```typescript
import { getLeaveWeight } from "@/lib/leaveUtils";
```
Remove the `require()` call from inside `countWorkingDays()`.

**File**: `src/lib/reportQueries.ts` (2 lines changed)

---

### Files to change

| File | Change |
|------|--------|
| `src/lib/reportQueries.ts` | Add static import of `getLeaveWeight`; remove `require()` inside `countWorkingDays` |
| `src/components/dashboard/EnhancedCompletionCard.tsx` | Fetch leave days in date range, subtract leave weights from working days, use user's resolved daily target |

