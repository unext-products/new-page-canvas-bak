

# Reporting Hierarchy Implementation Plan

## Problem
Currently, L2 and L3 users see and manage ALL subordinates in their verticals/programs. There is no direct manager-reportee relationship. Two L2 users in the same program both see all L1 users, rather than only their assigned reportees.

## Solution Overview
Introduce a `reporting_hierarchy` table that maps each user to their direct reporting manager. This creates explicit manager-reportee relationships that replace the current "same vertical/program = full access" model.

## Architecture

```text
Admin (org_admin)
  └── sees/manages ALL users (no change)

L3 (Vertical Head)
  └── sees L2 users assigned as direct reportees
      └── and transitively, all L1s who report to those L2s

L2 (Program Head)
  └── sees only L1 users assigned as direct reportees
```

---

## Step 1: Database — Create `reporting_hierarchy` table

New migration:
```sql
CREATE TABLE public.reporting_hierarchy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,          -- the reportee
  manager_id uuid NOT NULL,       -- the manager
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, manager_id)
);

ALTER TABLE public.reporting_hierarchy ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Org admins can manage reporting hierarchy"
  ON public.reporting_hierarchy FOR ALL
  USING (get_user_role(auth.uid()) = 'org_admin'::app_role);

CREATE POLICY "Super admins can manage all reporting hierarchy"
  ON public.reporting_hierarchy FOR ALL
  USING (is_super_admin(auth.uid()));

-- Managers can view their own reportees
CREATE POLICY "Managers can view their reportees"
  ON public.reporting_hierarchy FOR SELECT
  USING (manager_id = auth.uid());

-- Users can view their own reporting relationship
CREATE POLICY "Users can view own reporting"
  ON public.reporting_hierarchy FOR SELECT
  USING (user_id = auth.uid());
```

Also create a security definer helper function:
```sql
CREATE OR REPLACE FUNCTION public.get_direct_reportees(p_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[])
  FROM public.reporting_hierarchy
  WHERE manager_id = p_manager_id;
$$;

-- Transitive: get all L1s under an L3 (via their L2 reportees)
CREATE OR REPLACE FUNCTION public.get_transitive_reportees(p_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT r2.user_id), ARRAY[]::uuid[])
  FROM public.reporting_hierarchy r1
  JOIN public.reporting_hierarchy r2 ON r2.manager_id = r1.user_id
  WHERE r1.manager_id = p_manager_id;
$$;
```

---

## Step 2: Admin UI — Reportee Assignment in User Edit Dialog

In **`src/pages/Users.tsx`** (Edit Dialog), add a "Reportees" multi-select section:
- For **L2 users**: show a multi-select of L1 users in the same vertical/program, allowing admin to pick which L1s report to this L2.
- For **L3 users**: show a multi-select of L2 users in the same vertical, allowing admin to pick which L2s report to this L3.
- Load existing assignments from `reporting_hierarchy` on dialog open.
- On save, sync `reporting_hierarchy` (delete old + insert new).

Also add the same section to the **Create User** dialog for L2/L3 roles.

Additionally, display assigned reportees in the **User Detail** dialog so admins can quickly see the reporting structure.

---

## Step 3: Update Approvals Page (`src/pages/Approvals.tsx`)

Replace the current logic that finds approvable users by vertical/program membership with direct reportee lookups:

- **L2 approvers**: Query `reporting_hierarchy` where `manager_id = current L2 user` to get direct L1 reportee IDs. Only show entries from those L1s.
- **L3 approvers**: Query `reporting_hierarchy` where `manager_id = current L3 user` to get direct L2 reportees. Then query again to get L1s reporting to those L2s (transitive). Show entries from direct L2 reportees AND transitive L1 reportees.
- **Admin**: No change — continues to see all entries in org.

---

## Step 4: Update Team Page (`src/pages/Team.tsx`)

Same pattern as Approvals:
- **L2**: Show only direct L1 reportees from `reporting_hierarchy`.
- **L3**: Show direct L2 reportees + transitive L1 reportees.
- **Admin**: No change.

---

## Step 5: Update Reports — Member Select & Vertical View (`src/components/MemberSelect.tsx`, `src/lib/reportQueries.ts`)

- **MemberSelect**: When used by L2/L3, filter the member list to only show direct/transitive reportees.
- **Vertical/Department view reports** (`fetchVerticalReport`): For L2/L3 users, scope faculty breakdown to their reportee tree only.

---

## Step 6: Update RLS Policies on `timesheet_entries`

Add new RLS policies (or update existing ones) so L2/L3 users can only SELECT/UPDATE entries belonging to their reportees:

- **L2 SELECT/UPDATE**: `user_id = ANY(get_direct_reportees(auth.uid()))` AND role check confirms the entry owner is L1.
- **L3 SELECT/UPDATE**: `user_id = ANY(get_direct_reportees(auth.uid()))` (for L2 entries) OR `user_id = ANY(get_transitive_reportees(auth.uid()))` (for L1 entries).

The existing vertical/program-based policies will be replaced or made secondary to the reporting hierarchy policies.

---

## Step 7: Backward Compatibility & Data Migration

- **No data loss**: The existing `user_verticals`, `user_programs` tables remain untouched. The new `reporting_hierarchy` table is additive.
- **Fallback behavior**: If a manager has zero entries in `reporting_hierarchy`, the system falls back to the current vertical/program-based visibility. This ensures existing users continue working until admins configure the reporting structure.
- **Gradual adoption**: Admins can assign reportees at their own pace. Unassigned users remain visible via the old logic.

---

## Step 8: Dashboard Scoping (`src/pages/Dashboard.tsx`)

For L2/L3 dashboards that show team stats, scope the team member counts and aggregations to reportees only (with the same fallback).

---

## Files Affected

| File | Change |
|---|---|
| New migration SQL | `reporting_hierarchy` table, RLS, helper functions |
| `src/pages/Users.tsx` | Add reportee multi-select in edit/create dialogs, load/save hierarchy |
| `src/pages/Approvals.tsx` | Replace vertical/program user collection with reportee queries |
| `src/pages/Team.tsx` | Replace vertical/program scoping with reportee queries |
| `src/components/MemberSelect.tsx` | Filter members by reportee hierarchy for L2/L3 |
| `src/lib/reportQueries.ts` | Scope vertical report faculty list by reportees for L2/L3 |
| `src/pages/Dashboard.tsx` | Scope admin/manager stats to reportees |
| RLS policies on `timesheet_entries` | Add reportee-based policies |

---

## Key Design Decisions

1. **Reporting hierarchy is stored as direct relationships only** (manager → reportee). Transitive access (L3 → L1 via L2) is computed via a DB function.
2. **Admin retains full org-wide access** — no hierarchy filtering for admins.
3. **Fallback to current behavior** when no reporting hierarchy is configured, ensuring zero disruption to existing users.
4. **Reportee assignment is done from the manager's perspective** — admin edits an L2 user and selects which L1s report to them.

