

## Root Cause Analysis

### Issue 1: Cross-org category contamination

The RLS policy on `activity_categories` for org admins is:

```sql
Policy: "Org admins can manage categories"
Command: ALL
USING: (get_user_role(auth.uid()) = 'org_admin'::app_role)
```

There is **no organization check**. This means any org admin can read, insert, update, and delete categories belonging to **any** organization. When the MAB-1 admin edited categories, they could see and modify MAB's categories too.

Additionally, `CategorySettings.fetchCategories()` (line 215-226) only filters by `organization_id` when the `organizationId` prop is passed (super admin flow). For regular org admins, no client-side org filter is applied — it fetches all categories the RLS allows, which is everything.

### Issue 2: Timesheet shows default activities instead of admin-configured ones

`useActivityCategories` (line 57-62) fetches categories with `.eq("is_active", true)` but applies **no organization filter**. For L1 users, RLS does filter by org (`organization_id = get_user_organization(...) OR organization_id IS NULL`), so they should see their org's categories.

However, the hook has a **hardcoded fallback** (lines 76-94): when the query returns zero rows, it returns 5 default categories (Class, Quiz, Invigilation, Admin, Non-Academic). If the org's categories were corrupted or deleted due to the cross-org contamination from Issue 1, or if the query returns empty for any reason, L1 users see the hardcoded defaults instead of an empty state or error.

The fallback masks the real problem and creates a false sense of working categories that don't match what the admin configured.

## Fix Plan

### A. Fix RLS policy on `activity_categories` (database migration)

Replace the permissive org admin ALL policy with one that checks organization membership:

```sql
DROP POLICY "Org admins can manage categories" ON public.activity_categories;

CREATE POLICY "Org admins can manage categories"
ON public.activity_categories FOR ALL
TO public
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role)
  AND (organization_id = get_user_organization(auth.uid()))
);
```

### B. Fix `CategorySettings.fetchCategories()` — add org filter for regular admins

In `src/components/settings/CategorySettings.tsx`, when no `organizationId` prop is passed (regular org admin), fetch the user's org and filter by it:

```typescript
if (organizationId) {
  query = query.eq("organization_id", organizationId);
} else {
  // Regular org admin - filter by their own org
  const { data: orgId } = await supabase.rpc("get_user_organization", {
    user_id: userWithRole?.user.id,
  });
  if (orgId) {
    query = query.eq("organization_id", orgId);
  }
}
```

### C. Fix `useActivityCategories` — remove hardcoded fallback

In `src/hooks/useActivityCategories.ts`:
- Remove the hardcoded default categories fallback (lines 76-94)
- When query returns empty, set categories to empty array (which is the truth)
- This ensures L1 users see what the admin actually configured, not phantom defaults

### D. Fix `useActivityCategories` — add org filter

Add explicit organization filtering to the query so it doesn't rely solely on RLS:

```typescript
const { data: orgId } = await supabase.rpc("get_user_organization", {
  user_id: userWithRole?.user.id,
});
let query = supabase.from("activity_categories").select("*").eq("is_active", true);
if (orgId) {
  query = query.eq("organization_id", orgId);
}
```

### Files to change

| File | Change |
|------|--------|
| Database migration | Fix RLS policy: add org check to org_admin ALL policy |
| `src/components/settings/CategorySettings.tsx` | Add org filter for regular admin fetch |
| `src/hooks/useActivityCategories.ts` | Remove hardcoded fallback defaults; add explicit org filter to query |

