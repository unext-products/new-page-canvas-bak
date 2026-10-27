CREATE OR REPLACE FUNCTION public.get_manager_direct_reportees()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT COALESCE(array_agg(DISTINCT rh.user_id), ARRAY[]::uuid[])
 FROM public.reporting_hierarchy rh
 JOIN public.user_roles manager ON manager.user_id = rh.manager_id
 JOIN public.user_roles reportee ON reportee.user_id = rh.user_id AND reportee.organization_id = manager.organization_id
 WHERE rh.manager_id = auth.uid() AND manager.role IN ('l2','l3','program_manager','hod') AND rh.user_id <> auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_manager_direct_reportees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_direct_reportees() TO authenticated, service_role;

DO $$
DECLARE t text; owner_col text;
BEGIN
 FOR t, owner_col IN SELECT * FROM (VALUES ('profiles','id'),('user_roles','user_id'),('timesheet_entries','user_id'),('leave_days','user_id'),('user_verticals','user_id'),('user_programs','user_id'),('user_departments','user_id'),('user_batches','user_id'),('user_subjects','user_id'),('user_settings','user_id')) AS tables(t,c)
 LOOP
  EXECUTE format('CREATE POLICY "Direct manager scope guard" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.get_user_role((SELECT auth.uid()))) NOT IN (''l2'',''l3'',''program_manager'',''hod'') OR %I = (SELECT auth.uid()) OR %I IN (SELECT unnest(public.get_manager_direct_reportees()))) WITH CHECK ((SELECT public.get_user_role((SELECT auth.uid()))) NOT IN (''l2'',''l3'',''program_manager'',''hod'') OR %I = (SELECT auth.uid()) OR %I IN (SELECT unnest(public.get_manager_direct_reportees())))', t, owner_col, owner_col, owner_col, owner_col);
  EXECUTE format('CREATE POLICY "Managers read direct reportees" ON public.%I FOR SELECT TO authenticated USING (%I IN (SELECT unnest(public.get_manager_direct_reportees())))', t, owner_col);
 END LOOP;
END $$;

CREATE POLICY "Managers update direct reportee entries" ON public.timesheet_entries FOR UPDATE TO authenticated
 USING (user_id IN (SELECT unnest(public.get_manager_direct_reportees())))
 WITH CHECK (user_id IN (SELECT unnest(public.get_manager_direct_reportees())));

CREATE POLICY "Direct manager hierarchy guard" ON public.reporting_hierarchy AS RESTRICTIVE FOR ALL TO authenticated
 USING ((SELECT public.get_user_role((SELECT auth.uid()))) NOT IN ('l2','l3','program_manager','hod') OR manager_id = (SELECT auth.uid()) OR user_id = (SELECT auth.uid()))
 WITH CHECK ((SELECT public.get_user_role((SELECT auth.uid()))) NOT IN ('l2','l3','program_manager','hod') OR manager_id = (SELECT auth.uid()) OR user_id = (SELECT auth.uid()));