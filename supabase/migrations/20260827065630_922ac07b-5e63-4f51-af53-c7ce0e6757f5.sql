-- 1. Composite indexes for hot query shapes
CREATE INDEX IF NOT EXISTS idx_ts_user_date ON public.timesheet_entries (user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_ts_user_status ON public.timesheet_entries (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ts_status_date ON public.timesheet_entries (status, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_ts_user_status_date ON public.timesheet_entries (user_id, status, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_rh_manager ON public.reporting_hierarchy (manager_id);
CREATE INDEX IF NOT EXISTS idx_rh_user ON public.reporting_hierarchy (user_id);
CREATE INDEX IF NOT EXISTS idx_user_verticals_user ON public.user_verticals (user_id);
CREATE INDEX IF NOT EXISTS idx_user_verticals_vertical ON public.user_verticals (vertical_id);
CREATE INDEX IF NOT EXISTS idx_user_programs_user ON public.user_programs (user_id);
CREATE INDEX IF NOT EXISTS idx_leave_days_user_date ON public.leave_days (user_id, leave_date);

-- 2. Drop the 18 overlapping policies on timesheet_entries
DROP POLICY IF EXISTS "Super admins can manage all timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Users can manage their own entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Admin can view L3 entries in their org" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L2 can view L1 entries in their programs" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L2 can view entries in their verticals" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L2 can view reportee entries via hierarchy" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L3 can view entries in their verticals" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L3 can view reportee entries via hierarchy" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Org admins can view all entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Super admins can view all timesheet entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Users can view their own entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Admin can update L3 entries in their org" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L2 can update L1 entries in their programs" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L2 can update entries in their verticals" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L2 can update reportee entries via hierarchy" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L3 can update entries in their verticals" ON public.timesheet_entries;
DROP POLICY IF EXISTS "L3 can update reportee entries via hierarchy" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Org admins can update entries in their org" ON public.timesheet_entries;

-- 3. Recreate as 4 policies with auth lookups evaluated once per query
CREATE POLICY "Super admins manage all entries"
ON public.timesheet_entries
FOR ALL
TO authenticated
USING ((SELECT public.is_super_admin((SELECT auth.uid()))))
WITH CHECK ((SELECT public.is_super_admin((SELECT auth.uid()))));

CREATE POLICY "Users manage their own entries"
ON public.timesheet_entries
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Managers and admins can view entries"
ON public.timesheet_entries
FOR SELECT
TO authenticated
USING (
  (SELECT public.get_user_role((SELECT auth.uid()))) = 'org_admin'::app_role
  OR (
    (SELECT public.get_user_role((SELECT auth.uid()))) = 'l2'::app_role
    AND (
      timesheet_entries.user_id IN (SELECT unnest(public.get_direct_reportees((SELECT auth.uid()))))
      OR (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = timesheet_entries.user_id AND ur.role = 'l1'::app_role
        )
        AND (
          timesheet_entries.program_id IN (SELECT unnest(public.get_user_programs((SELECT auth.uid()))))
          OR EXISTS (
            SELECT 1 FROM public.user_verticals uv
            WHERE uv.user_id = timesheet_entries.user_id
              AND uv.vertical_id IN (SELECT unnest(public.get_user_verticals((SELECT auth.uid()))))
          )
        )
      )
    )
  )
  OR (
    (SELECT public.get_user_role((SELECT auth.uid()))) = 'l3'::app_role
    AND (
      timesheet_entries.user_id IN (SELECT unnest(public.get_all_reportees((SELECT auth.uid()))))
      OR (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = timesheet_entries.user_id
            AND ur.role = ANY (ARRAY['l1'::app_role, 'l2'::app_role])
        )
        AND (
          (timesheet_entries.vertical_id IS NOT NULL
            AND timesheet_entries.vertical_id IN (SELECT unnest(public.get_user_verticals((SELECT auth.uid())))))
          OR (timesheet_entries.vertical_id IS NULL AND EXISTS (
            SELECT 1 FROM public.user_verticals uv
            WHERE uv.user_id = timesheet_entries.user_id
              AND uv.vertical_id IN (SELECT unnest(public.get_user_verticals((SELECT auth.uid()))))
          ))
        )
      )
    )
  )
);

CREATE POLICY "Managers and admins can update entries"
ON public.timesheet_entries
FOR UPDATE
TO authenticated
USING (
  (
    (SELECT public.get_user_role((SELECT auth.uid()))) = 'org_admin'::app_role
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = timesheet_entries.user_id
        AND ur.organization_id = (SELECT public.get_user_organization((SELECT auth.uid())))
    )
  )
  OR (
    (SELECT public.get_user_role((SELECT auth.uid()))) = 'l2'::app_role
    AND (
      timesheet_entries.user_id IN (SELECT unnest(public.get_direct_reportees((SELECT auth.uid()))))
      OR (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = timesheet_entries.user_id AND ur.role = 'l1'::app_role
        )
        AND (
          timesheet_entries.program_id IN (SELECT unnest(public.get_user_programs((SELECT auth.uid()))))
          OR EXISTS (
            SELECT 1 FROM public.user_verticals uv
            WHERE uv.user_id = timesheet_entries.user_id
              AND uv.vertical_id IN (SELECT unnest(public.get_user_verticals((SELECT auth.uid()))))
          )
        )
      )
    )
  )
  OR (
    (SELECT public.get_user_role((SELECT auth.uid()))) = 'l3'::app_role
    AND (
      timesheet_entries.user_id IN (SELECT unnest(public.get_all_reportees((SELECT auth.uid()))))
      OR (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = timesheet_entries.user_id
            AND ur.role = ANY (ARRAY['l1'::app_role, 'l2'::app_role])
        )
        AND (
          (timesheet_entries.vertical_id IS NOT NULL
            AND timesheet_entries.vertical_id IN (SELECT unnest(public.get_user_verticals((SELECT auth.uid())))))
          OR (timesheet_entries.vertical_id IS NULL AND EXISTS (
            SELECT 1 FROM public.user_verticals uv
            WHERE uv.user_id = timesheet_entries.user_id
              AND uv.vertical_id IN (SELECT unnest(public.get_user_verticals((SELECT auth.uid()))))
          ))
        )
      )
    )
  )
)
WITH CHECK (true);

ANALYZE public.timesheet_entries;
