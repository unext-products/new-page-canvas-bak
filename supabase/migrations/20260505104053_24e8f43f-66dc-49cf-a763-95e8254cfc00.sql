
-- L2 can view entries from their direct reportees in reporting_hierarchy
CREATE POLICY "L2 can view reportee entries via hierarchy"
ON public.timesheet_entries FOR SELECT TO authenticated
USING (
  get_user_role(auth.uid()) = 'l2'::app_role
  AND EXISTS (
    SELECT 1 FROM public.reporting_hierarchy rh
    WHERE rh.manager_id = auth.uid()
      AND rh.user_id = timesheet_entries.user_id
  )
);

-- L2 can update entries from their direct reportees in reporting_hierarchy
CREATE POLICY "L2 can update reportee entries via hierarchy"
ON public.timesheet_entries FOR UPDATE TO authenticated
USING (
  get_user_role(auth.uid()) = 'l2'::app_role
  AND EXISTS (
    SELECT 1 FROM public.reporting_hierarchy rh
    WHERE rh.manager_id = auth.uid()
      AND rh.user_id = timesheet_entries.user_id
  )
);

-- L3 can view entries from their reportees (direct + transitive) via hierarchy
CREATE POLICY "L3 can view reportee entries via hierarchy"
ON public.timesheet_entries FOR SELECT TO authenticated
USING (
  get_user_role(auth.uid()) = 'l3'::app_role
  AND EXISTS (
    SELECT 1 FROM public.reporting_hierarchy rh
    WHERE rh.manager_id = auth.uid()
      AND rh.user_id = timesheet_entries.user_id
    UNION
    SELECT 1 FROM public.reporting_hierarchy r1
    JOIN public.reporting_hierarchy r2 ON r2.manager_id = r1.user_id
    WHERE r1.manager_id = auth.uid()
      AND r2.user_id = timesheet_entries.user_id
  )
);

-- L3 can update entries from their reportees (direct + transitive) via hierarchy
CREATE POLICY "L3 can update reportee entries via hierarchy"
ON public.timesheet_entries FOR UPDATE TO authenticated
USING (
  get_user_role(auth.uid()) = 'l3'::app_role
  AND EXISTS (
    SELECT 1 FROM public.reporting_hierarchy rh
    WHERE rh.manager_id = auth.uid()
      AND rh.user_id = timesheet_entries.user_id
    UNION
    SELECT 1 FROM public.reporting_hierarchy r1
    JOIN public.reporting_hierarchy r2 ON r2.manager_id = r1.user_id
    WHERE r1.manager_id = auth.uid()
      AND r2.user_id = timesheet_entries.user_id
  )
);
