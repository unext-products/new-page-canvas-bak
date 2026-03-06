

## Plan: Fix Sign Out and Blank Page Issues

### Root Causes

**Issue 1: Sign out does nothing**
`supabase.auth.signOut()` (default `scope: 'global'`) makes a server call to revoke the token. If the token is already expired or the network request fails, `signOut()` returns an error. The current code only navigates on success — so nothing happens. The local session in localStorage is never cleared, and the user stays "logged in."

**Issue 2: Blank page on load with corrupted/expired session**
When localStorage contains an expired session whose refresh token is also invalid, `onAuthStateChange` fires `INITIAL_SESSION` with the stale session object from localStorage. The code sets `user` (truthy), then `getUserWithRole` fails all 3 retry attempts (because the token is invalid for API calls). Meanwhile, `Index.tsx` sees `user` is set and redirects to `/dashboard`, which can't load any data. Result: blank page. Only clearing site data fixes it because that removes the corrupted localStorage session.

**Issue 3: Stale closure bug**
Line 39 references `userWithRole` inside the `useEffect` callback, but the dependency array is `[]`. This means `userWithRole` is always the initial value (`null`), so the `TOKEN_REFRESHED` optimization (`if (event === 'TOKEN_REFRESHED' && userWithRole)`) never triggers. Not the primary bug, but it's a latent issue.

### Fix

**1. `src/lib/supabase.ts` — Make sign out always clear local state**

Change `signOut()` to use `{ scope: 'local' }` as a fallback:

```typescript
export async function signOut() {
  // Try global sign out first (revokes token server-side)
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    // If server-side fails (expired token, network issue), clear local state
    await supabase.auth.signOut({ scope: 'local' });
  }
  return { error: null }; // Always succeed from caller's perspective
}
```

This ensures local session is always cleared, even when the server rejects the revocation request.

**2. `src/contexts/AuthContext.tsx` — Validate session on failed profile fetch + fix stale closure**

After all retry attempts fail for `getUserWithRole`, verify the session is actually valid by calling `supabase.auth.getUser()`. If that also fails, sign out locally to clear the corrupted session:

```typescript
// After all retries exhausted and userData is still null:
if (!userData && fetchId === latestFetchId) {
  // Session might be corrupted — verify it
  const { error: verifyError } = await supabase.auth.getUser();
  if (verifyError) {
    // Token is invalid, clear corrupted session
    await supabase.auth.signOut({ scope: 'local' });
    return; // onAuthStateChange will fire again with null session
  }
}
```

Also fix the stale closure by using a ref for `userWithRole`:

```typescript
const userWithRoleRef = useRef<UserWithRole | null>(null);
// Keep ref in sync
useEffect(() => { userWithRoleRef.current = userWithRole; }, [userWithRole]);

// In onAuthStateChange handler, use userWithRoleRef.current instead of userWithRole
```

**3. `src/components/AppSidebar.tsx` — Always navigate on sign out**

Since `signOut()` will now always succeed, simplify the handler:

```typescript
const handleSignOut = async () => {
  await signOut();
  navigate("/");
};
```

### Files to Change

| File | Change |
|------|--------|
| `src/lib/supabase.ts` | Fallback to `scope: 'local'` sign out if global fails; always return success |
| `src/contexts/AuthContext.tsx` | Add session validation after failed retries; fix stale closure with ref |
| `src/components/AppSidebar.tsx` | Simplify sign out handler (always navigate) |

### What Stays the Same

- All page components, data, database — no changes
- Sign in flow — unchanged
- RLS policies — unchanged
- All existing features — unchanged

