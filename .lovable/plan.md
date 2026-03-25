# Reporting Hierarchy — IMPLEMENTED

## What was done

1. **Database**: Created `reporting_hierarchy` table with RLS policies and helper functions (`get_direct_reportees`, `get_transitive_reportees`, `get_all_reportees`, `has_reporting_hierarchy`).

2. **Shared library** (`src/lib/reportingHierarchy.ts`): Client-side helpers for fetching reportees, checking hierarchy existence, saving assignments, and `getVisibleUserIds()` with automatic fallback to legacy logic.

3. **Users page**: Added `ReporteeSelect` component for admins to assign L1→L2 and L2→L3 reportees in both Create and Edit dialogs. User Detail dialog shows assigned reportees.

4. **Approvals page**: L2/L3 user collection now checks `reporting_hierarchy` first, falls back to vertical/program-based logic if no hierarchy configured.

5. **Team page**: Same hierarchy-first approach with legacy fallback.

6. **Dashboard**: HOD/Manager dashboard scoped to reportees when hierarchy is configured.

## Fallback behavior
If a manager has zero entries in `reporting_hierarchy`, the system uses the existing vertical/program-based visibility — zero disruption for existing users.
