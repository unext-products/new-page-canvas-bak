

## Root Cause Analysis: Dashboard Freeze, Missing Name, and Sign-Out Failure

### The Core Problem: Same Token-Refresh Instability Pattern

All three issues stem from the same root cause identified in the timesheet fixes: auth token refreshes create a new `userWithRole` object reference, causing cascading re-execution of heavy effects.

### Issue 1 — Dashboard freezes after 3-4 minutes

`Dashboard.tsx` line 86-88:
```typescript
useEffect(() => {
  loadDashboardData();
}, [userWithRole]);
```

`loadDashboardData` makes **10-15 sequential database queries** (entries, leaves, departments, profiles, weekly stats, etc.). When a token refresh fires after ~3-4 minutes and produces a new `userWithRole` reference, this effect re-triggers the entire heavy load **while the previous one may still be running**. Multiple concurrent heavy loads saturate the browser's connection pool (browsers allow ~6 concurrent requests per origin), causing all Supabase requests to queue and the UI to freeze. The freeze also blocks sign-out clicks and navigation.

### Issue 2 — Faculty name shows "User" on refresh

`AppSidebar.tsx` line 163: `const userName = userWithRole?.profile?.full_name || "User"`. During page refresh, `userWithRole` is `null` while `loading` is `true`. The Dashboard renders the Layout (which renders AppSidebar) immediately, showing "User" as the fallback. If `getUserWithRole` takes time (retries on failure), the name stays as "User" for several seconds. If it ultimately fails and returns `null`, it stays permanently.

### Issue 3 — Sign-out doesn't work

Two compounding causes:
1. **UI frozen**: If the dashboard is in a query storm (issue 1), the event loop is saturated. The sign-out button click either doesn't register or the async `signOut()` can't execute because the connection pool is exhausted by dashboard queries.
2. **Race condition**: After `signOut()` succeeds, `onAuthStateChange` fires with `null` session, setting `userWithRole` to `null`. But `handleSignOut` also calls `navigate("/")`. The Index page checks `if (!authLoading && user)` and redirects to `/dashboard`. If the auth state hasn't fully cleared by the time Index renders, it bounces back to the dashboard — appearing as if sign-out "didn't work."

### Fix Plan

**File: `src/pages/Dashboard.tsx`**

1. **Add initialization guard** — Use a `hasLoadedRef` to ensure dashboard data loads only once on initial auth, not on every `userWithRole` reference change. Provide a manual refresh mechanism if needed.

```typescript
const hasLoadedRef = useRef(false);
useEffect(() => {
  if (!userWithRole || hasLoadedRef.current) return;
  hasLoadedRef.current = true;
  loadDashboardData();
}, [userWithRole]);
```

**File: `src/components/AppSidebar.tsx`**

2. **Guard sign-out against double-click and frozen state** — Add a `signingOut` ref to prevent multiple concurrent sign-out attempts, and use `window.location.href` as a hard redirect fallback if `navigate` fails to take effect.

```typescript
const signingOutRef = useRef(false);
const handleSignOut = async () => {
  if (signingOutRef.current) return;
  signingOutRef.current = true;
  await signOut();
  navigate("/");
};
```

3. **Show skeleton for user info while loading** — Instead of showing "User" as fallback while `userWithRole` is loading, show a subtle skeleton placeholder in the sidebar footer until auth data is available.

**File: `src/pages/Index.tsx`**

4. **Tighten the redirect guard** — Currently checks `!authLoading && user`. After sign-out, `user` becomes null before `session` is fully cleared. Add a check for `session` being present to prevent premature redirect back to dashboard.

```typescript
useEffect(() => {
  if (!authLoading && user && session) {
    navigate("/dashboard");
  }
}, [user, session, authLoading, navigate]);
```

### Files to Change

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add `hasLoadedRef` guard to prevent re-loading on token refresh |
| `src/components/AppSidebar.tsx` | Add sign-out guard; show skeleton while `userWithRole` is loading |
| `src/pages/Index.tsx` | Add `session` check to redirect guard to prevent post-signout bounce |

### What Stays the Same
- AuthContext, token refresh logic — unchanged
- Database, RLS policies — unchanged
- Timesheet, bulk upload, approvals — unchanged
- All other pages — unchanged

