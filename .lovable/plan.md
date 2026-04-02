

# User Impersonation (View-Only)

## Overview
Allow Admin and Super Admin users to "impersonate" an L1, L2, or L3 user from the Users page. Impersonation is view-only — all mutating actions (Add/Edit/Delete/Approve) are disabled. A bottom bar shows who is being impersonated with a close button to end it.

## Approach
Create an `ImpersonationContext` that holds the impersonated user's data. When active, it overrides the role/profile returned by `useAuth` throughout the app without changing the actual authenticated session. All components already use `useAuth()` for role checks, so a thin wrapper approach works cleanly.

## Changes

### 1. New: `src/contexts/ImpersonationContext.tsx`
- Stores impersonated user state: `{ userId, fullName, role, profile, verticalId }` or null
- Provides `startImpersonation(userId)` — fetches the target user's role/profile from DB and sets state
- Provides `stopImpersonation()` — clears state
- Provides `isImpersonating: boolean` and `isReadOnly: boolean` (same as isImpersonating)
- Export a `useImpersonation()` hook

### 2. Edit: `src/contexts/AuthContext.tsx`
- When impersonation is active, `useAuth()` returns the impersonated user's `userWithRole` (role, profile, verticalId) instead of the real one, but keeps the real `user` and `session` intact
- Add `realUserWithRole` to the context so components can check the actual admin role when needed (e.g., to show the impersonate button)
- Alternatively: create a wrapper hook `useEffectiveAuth()` that merges impersonation — but modifying `useAuth` directly is simpler since all pages already use it

### 3. New: `src/components/ImpersonationBar.tsx`
- Fixed bottom bar (z-50) showing: "Viewing as [Name] ([Role])" with a Close/End button
- Only renders when `isImpersonating` is true
- Styled distinctly (e.g., amber/warning background) so it's clearly visible

### 4. Edit: `src/pages/Users.tsx`
- Add an "Impersonate" button (eye icon) in the user row actions
- Only visible for Admin/Super Admin
- Hidden for users with Admin/Super Admin roles (can't impersonate admins)
- Calls `startImpersonation(userId)`

### 5. Edit: `src/components/Layout.tsx`
- Render `<ImpersonationBar />` at the bottom of the layout

### 6. Read-Only Mode
- The `isReadOnly` flag from ImpersonationContext will be used to disable mutating UI:
  - Disable all Button components with mutating actions by checking `useImpersonation().isReadOnly` in key pages (Timesheet, Approvals, Settings, etc.)
  - A pragmatic approach: add a CSS `pointer-events: none` overlay or disable submit buttons in forms
  - Best approach: add a global check — in `Layout.tsx`, when `isReadOnly`, apply a class that disables form submissions and button clicks except navigation

### 7. Edit: `src/main.tsx` or `src/App.tsx`
- Wrap the app with `<ImpersonationProvider>`

## Technical Details
- No database changes needed — impersonation is purely client-side view switching
- The actual Supabase session remains the admin's, so RLS still applies as admin (data visibility matches admin, which is fine for view-only)
- The sidebar navigation will update to show the impersonated role's menu items since it reads from `useAuth()`
- Security: impersonation state is in-memory only (not persisted to localStorage), so refreshing ends it

## Files
1. **New**: `src/contexts/ImpersonationContext.tsx` — impersonation state & logic
2. **New**: `src/components/ImpersonationBar.tsx` — bottom bar UI
3. **Edit**: `src/contexts/AuthContext.tsx` — expose `realUserWithRole` and merge impersonation into `userWithRole`
4. **Edit**: `src/pages/Users.tsx` — add impersonate button per user row
5. **Edit**: `src/components/Layout.tsx` — render ImpersonationBar + read-only overlay
6. **Edit**: `src/App.tsx` — wrap with ImpersonationProvider

