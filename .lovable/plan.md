
RCA summary (from code + runtime evidence):

1) Primary root cause: auth lifecycle deadlock risk in `AuthContext`
- `onAuthStateChange` currently uses an `async` callback and performs awaited Supabase calls inside it (`getUserWithRole`, retries, `auth.getUser`, `auth.signOut`).
- This pattern is known to intermittently lock auth state processing. Symptoms match exactly:
  - `/` stays blank (because `Index.tsx` returns `null` while `authLoading=true`)
  - session gets stuck until storage is cleared
  - sign-out appears unresponsive in that stuck state

2) Secondary root cause: unauthenticated users can still access private routes
- In `App.tsx`, `/dashboard` and all app routes are public (no route guard).
- When session is missing/corrupted, user can still land on dashboard and see:
  - “Setup Required”
  - fallback identity “User” + “L1” badge from sidebar defaults
- This creates a false “logged in but broken” state.

3) Tertiary root cause: degraded profile/role fetch is treated as success
- `getUserWithRole()` does not fail when role/profile query returns an error object; it still returns `{ user, role: null, profile: null }`.
- That converts transient auth/read failures into persistent “Setup Required / User” UI.
- Combined with TOKEN_REFRESH skip logic, bad state can persist across refreshes.

4) Evidence alignment with user report
- Screenshot behavior reproduced: dashboard shell + setup required + “User/L1”.
- DB shows Moses has a valid `user_roles` row (so “setup required” is not true configuration absence).
- Auth logs show successful login/logout events, suggesting issue is client-side session/auth-state handling, not backend auth outage.

Implementation plan (clean, minimal blast radius):

A) Harden auth state orchestration (`src/contexts/AuthContext.tsx`)
- Refactor `onAuthStateChange` callback to be synchronous (non-async).
- Move all async work to a separate queued resolver (e.g. `queueMicrotask`/`setTimeout(0)` + guarded async function).
- Keep fetch-id guard, but ensure loading is always resolved (no indefinite loading).
- Add bootstrap watchdog: if auth init exceeds threshold, force a safe recovery path (local sign-out + loading false).
- Change TOKEN_REFRESH behavior:
  - only skip refetch when current user payload is healthy
  - if current payload is degraded (missing role/profile due transient failure), allow refetch recovery.

B) Treat role/profile read failures as failures, not “setup required” (`src/lib/supabase.ts`)
- In `getUserWithRole`, explicitly check query `error` fields.
- If role/profile query errors occur (auth/RLS/network), return `null` so AuthContext retry + recovery logic runs.
- Keep genuine “no role assigned” (`data=null` with no query error) as valid setup-required scenario.
- Strengthen `signOut`:
  - guaranteed local clear path
  - deterministic completion even when global revoke stalls/fails.

C) Add route-level protection (`src/App.tsx` + new small guard component or inline wrapper)
- Protect all private app routes (`/dashboard`, `/timesheet`, `/calendar`, `/approvals`, `/users`, `/organizations`, `/programs`, `/departments`, `/verticals`, `/batches`, `/terms`, `/subjects`, `/reports`, `/bulk-import`, `/team`, `/settings`).
- Public routes remain `/`, `/auth`, `/pricing`.
- Guard behavior:
  - while auth loading: show lightweight loading screen (not blank)
  - if no valid session: redirect to `/`
  - if session exists: render route.
- This prevents the broken “dashboard with no real session” state.

D) Stop false “User/L1” display and false setup rendering (`src/components/AppSidebar.tsx`, `src/pages/Dashboard.tsx`)
- Sidebar:
  - remove default role fallback to “member/L1” when user is unknown
  - show skeleton/neutral state until auth resolved
  - disable sign-out button while signout in progress; always reset guard safely.
- Dashboard:
  - gate setup-required card behind resolved auth + confirmed session
  - do not show setup-required during transient auth loading.

E) Remove blank-screen UX trap on root (`src/pages/Index.tsx`)
- Replace `if (authLoading) return null;` with a visible loading shell.
- Ensures users never see a white page even during slow auth init/recovery.

Technical details (for implementation confidence):
- No database schema or RLS migration required for this fix.
- This is an auth/session state-machine correction + routing guard hardening.
- Existing stabilization work (refs/hasLoaded guards for timesheet/bulk/dashboard) remains intact.
- Key invariant after fix:
  - “No valid session” can only render public login route.
  - “Valid session but no assigned role” can render setup-required intentionally.
  - “Transient fetch failure” must retry/recover, not be mistaken for no-role.

Verification plan (must-pass before closure):
1) Session persistence
- Login as L1, reload `/dashboard` repeatedly, wait 5+ minutes, reload again.
- Expected: never blank page, never false setup-required.

2) Logout reliability
- Sign out from dashboard, from timesheet, and after idle period.
- Expected: immediate return to login, no bounce-back to dashboard.

3) Corrupted/local stale session recovery
- Simulate stale auth token in storage and reload `/`.
- Expected: app self-recovers to login without manual browser-history/cache clearing.

4) Setup-required correctness
- Test with genuinely unassigned user.
- Expected: setup-required appears only for that user (with active valid session), not randomly for configured users.

5) Regression check
- L1 timesheet submit, bulk upload validation, dashboard responsiveness all unaffected.

Files to be changed:
- `src/contexts/AuthContext.tsx`
- `src/lib/supabase.ts`
- `src/App.tsx` (plus optional small `ProtectedRoute` helper file)
- `src/components/AppSidebar.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Index.tsx`
