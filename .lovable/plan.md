

# Maintenance Mode

## Overview
Add a "Maintenance Mode" toggle in Settings → Organization. When enabled, all users except Admin and Super Admin see a full-screen maintenance page with only a logout option. Admins/Super Admins continue using the app normally.

## Approach
Store the maintenance mode flag in the existing `settings` table (key: `maintenance_mode`, value: `true`/`false`) scoped to the organization. Check this flag in `ProtectedRoute` and redirect non-admin users to a maintenance page.

## Changes

### 1. Maintenance Mode Toggle (OrganizationSettings.tsx)
- Add a new Card section "Maintenance Mode" below the existing Organization Details card
- Include a Switch toggle with description explaining the impact
- On toggle, upsert a row in the `settings` table with `key = 'maintenance_mode'` and the org's ID
- Fetch current state on mount

### 2. Maintenance Page (new: `src/pages/Maintenance.tsx`)
- Full-screen page with logo, maintenance message ("The system is currently under maintenance"), and a Logout button
- Clean, simple design — no sidebar or navigation

### 3. Maintenance Check in ProtectedRoute
- After session is confirmed, query the `settings` table for `maintenance_mode`
- If enabled and user role is NOT `admin`/`org_admin`/`super_admin`, render `<Maintenance />` instead of children
- Cache the check to avoid repeated queries (use AuthContext or a lightweight hook)

### 4. Hook: `useMaintenanceMode` (new: `src/hooks/useMaintenanceMode.ts`)
- Fetches maintenance_mode from settings table for the user's organization
- Returns `{ isMaintenanceMode: boolean, loading: boolean }`
- Used in ProtectedRoute and OrganizationSettings

### Files
1. **New**: `src/pages/Maintenance.tsx` — maintenance page with logout
2. **New**: `src/hooks/useMaintenanceMode.ts` — fetch maintenance flag
3. **Edit**: `src/components/settings/OrganizationSettings.tsx` — add toggle section
4. **Edit**: `src/components/ProtectedRoute.tsx` — check maintenance mode, block non-admins

### Technical Notes
- Uses existing `settings` table (no migration needed) with `key = 'maintenance_mode'`
- The settings table has public SELECT RLS, so all authenticated users can read the flag
- Only org_admin/super_admin can write to settings (existing RLS)
- ProtectedRoute already has access to `useAuth()` for role checking via `userWithRole`

