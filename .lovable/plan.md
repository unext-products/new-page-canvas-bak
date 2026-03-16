

## Plan: Fix Session/Reload User Data Loss

### Root Causes

1. **Duplicate data fetching race condition**: Both `onAuthStateChange` and `getSession()` fire on mount and independently call `getUserWithRole()`. They race against each other, and the loser can overwrite the winner's result with stale or null data.

2. **No retry on failure**: If `getUserWithRole` fails (e.g., during token refresh), `userWithRole` stays permanently `null`, showing "Setup Required" and "User L1".

3. **`setTimeout(..., 0)` creates a render gap**: Between `user` being set and `userWithRole` being populated, components render with `user` present but no profile/role, causing fallback to "User" / "L1".

4. **Idle/background tab token expiry**: When returning after idle, the auth state change fires but the role fetch can fail if the token hasn't fully refreshed yet.

### Fix

**File: `src/contexts/AuthContext.tsx`** -- Rewrite the auth initialization logic:

1. **Remove the duplicate `getSession` call**. Supabase's `onAuthStateChange` already fires an `INITIAL_SESSION` event on setup, so `getSession()` is redundant and causes the race.

2. **Remove `setTimeout(..., 0)` wrappers**. Fetch role data synchronously within the auth state handler using `await`. This eliminates the render gap where `user` exists but `userWithRole` is null.

3. **Add retry logic for `getUserWithRole`**. If the profile/role fetch fails (returns `null`), retry up to 2 times with a short delay (500ms). This handles transient failures during token refresh.

4. **Add a `fetchId` guard** to prevent stale responses from overwriting fresh ones. Each auth state change increments a counter; when the async `getUserWithRole` call completes, it only updates state if its `fetchId` still matches the latest one.

5. **Handle `TOKEN_REFRESHED` event properly**. On token refresh, re-fetch `userWithRole` to ensure fresh data, but only if `userWithRole` is currently null (avoids unnecessary refetches during normal refresh cycles).

**File: `src/lib/supabase.ts`** -- Minor improvement to `getUserWithRole`:

6. **Use the passed `userId` for the auth user instead of calling `getUser()` again**. The current code fetches role+profile in parallel, then separately calls `supabase.auth.getUser()`. This extra call can fail during token transitions. Since we already have the `User` object from the session in `AuthContext`, pass it directly instead of re-fetching.

**File: `src/components/AppSidebar.tsx`** -- No changes needed. The sidebar already handles `userWithRole` being null by falling back to "User" / "member". Once the context fix ensures `userWithRole` is always populated before `loading` becomes `false`, this fallback will only show during genuine loading states.

### Technical Details

**Updated AuthContext pattern:**

```text
useEffect(() => {
  let latestFetchId = 0;

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const fetchId = ++latestFetchId;
        
        // Fetch with retry
        let userData = await getUserWithRole(session.user.id, session.user);
        if (!userData) {
          await delay(500);
          userData = await getUserWithRole(session.user.id, session.user);
        }
        
        // Only update if this is still the latest fetch
        if (fetchId === latestFetchId) {
          setUserWithRole(userData);
          setLoading(false);
        }
      } else {
        setUserWithRole(null);
        setLoading(false);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

**Updated getUserWithRole signature:**

```text
// Accept optional User object to avoid re-fetching from auth
async function getUserWithRole(userId: string, authUser?: User): Promise<UserWithRole | null>
```

This removes the `supabase.auth.getUser()` call inside `getUserWithRole` when the `User` object is already available from the session, eliminating a failure point during token transitions.

### Files to Change

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Remove duplicate `getSession`; remove `setTimeout`; add fetch ID guard and retry logic; pass `session.user` to `getUserWithRole` |
| `src/lib/supabase.ts` | Add optional `authUser` parameter to `getUserWithRole` to skip redundant `getUser()` call |

### What Stays the Same

- All page components, sidebar, dashboard -- no changes
- Sign in/sign out flows -- unchanged
- RLS policies and database -- unchanged
- All existing features continue working as-is

