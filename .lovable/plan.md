

# Fix Non-Starters Visibility for L3 and L2 Roles

## Problem
When L3 or L2 users log into Reports > Department View, the "Non-Starters" section does not display. The data queries rely on RLS-protected tables, and there are profile visibility gaps for L2 users specifically.

## Root Cause Analysis

1. **L2 Profile RLS restriction**: The `profiles` table RLS for L2 only allows viewing **L1 profiles in their programs**. When the non-starters query fetches profiles for users who haven't submitted timesheets, L2 users cannot see L2/L3 profiles or profiles outside their program scope — those rows are silently filtered out by RLS, resulting in an empty or incomplete Non-Starters list.

2. **L3 should work in theory** since L3's profile RLS allows viewing all profiles in their verticals. However, if no non-starters exist for the selected period/vertical, the section correctly won't render. We should verify and add defensive handling.

## Changes

### 1. Add L2 profile visibility RLS policy (Database Migration)
Add a new RLS SELECT policy on `profiles` so L2 can view profiles of users in their assigned verticals (not just L1 in programs). This mirrors the L3 policy pattern.

```sql
CREATE POLICY "L2 can view profiles in their verticals"
ON public.profiles FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'l2'::app_role) 
  AND EXISTS (
    SELECT 1 FROM user_verticals uv 
    WHERE uv.user_id = profiles.id 
    AND uv.vertical_id = ANY(get_user_verticals(auth.uid()))
  )
);
```

### 2. Filter non-starters to exclude inactive users (Code)
In `src/lib/reportQueries.ts`, update the non-starter profiles query to filter out inactive users (`is_active = true`), matching the faculty breakdown behavior. Also exclude admin/super_admin roles from the non-starters list since they don't submit timesheets.

### 3. No UI changes needed
The existing Non-Starters section rendering logic in `Reports.tsx` already handles the case — it renders when `nonStarters.length > 0`. The fix is purely at the data/RLS layer.

## Files
1. **Database migration** — Add L2 profile visibility policy for verticals
2. **Edit**: `src/lib/reportQueries.ts` — Filter non-starters by `is_active` and exclude admin roles

