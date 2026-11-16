CREATE OR REPLACE FUNCTION public.get_reporting_scope(p_manager_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH manager AS (
 SELECT ur.user_id, ur.role, ur.organization_id FROM public.user_roles ur
 WHERE ur.user_id=p_manager_id AND (p_manager_id=auth.uid() OR public.is_super_admin(auth.uid()) OR (public.get_user_role(auth.uid())='org_admin' AND ur.organization_id=public.get_user_organization(auth.uid())))
), direct AS (
 SELECT DISTINCT rh.user_id, r.role FROM manager m JOIN public.reporting_hierarchy rh ON rh.manager_id=m.user_id JOIN public.user_roles r ON r.user_id=rh.user_id AND r.organization_id=m.organization_id
 WHERE m.role IN ('l3','hod','l2','program_manager') AND rh.user_id<>p_manager_id
), visible AS (
 SELECT user_id FROM direct
 UNION
 SELECT rh.user_id FROM manager m JOIN direct d ON d.role IN ('l2','program_manager') JOIN public.reporting_hierarchy rh ON rh.manager_id=d.user_id JOIN public.user_roles r ON r.user_id=rh.user_id AND r.organization_id=m.organization_id
 WHERE m.role IN ('l3','hod') AND r.role IN ('l1','faculty') AND rh.user_id<>p_manager_id
)
SELECT COALESCE(array_agg(DISTINCT user_id),ARRAY[]::uuid[]) FROM visible;
$$;
REVOKE ALL ON FUNCTION public.get_reporting_scope(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reporting_scope(uuid) TO authenticated, service_role;
DO $$
DECLARE t text; c text; direct_pred text; read_pred text;
BEGIN
FOR t,c IN SELECT * FROM (VALUES ('profiles','id'),('user_roles','user_id'),('timesheet_entries','user_id'),('leave_days','user_id'),('user_verticals','user_id'),('user_programs','user_id'),('user_departments','user_id'),('user_batches','user_id'),('user_subjects','user_id'),('user_settings','user_id')) AS x(t,c)
LOOP
 direct_pred := format('(SELECT public.get_user_role((SELECT auth.uid()))) NOT IN (''l2'',''l3'',''program_manager'',''hod'') OR %I=(SELECT auth.uid()) OR %I IN (SELECT unnest(public.get_manager_direct_reportees()))',c,c);
 read_pred := format('(SELECT public.get_user_role((SELECT auth.uid()))) NOT IN (''l2'',''l3'',''program_manager'',''hod'') OR %I=(SELECT auth.uid()) OR %I IN (SELECT unnest(public.get_reporting_scope((SELECT auth.uid()))))',c,c);
 EXECUTE format('DROP POLICY "Direct manager scope guard" ON public.%I',t);
 EXECUTE format('CREATE POLICY "Manager reporting read guard" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',t,read_pred);
 EXECUTE format('CREATE POLICY "Direct manager insert guard" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)',t,direct_pred);
 EXECUTE format('CREATE POLICY "Direct manager update guard" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',t,direct_pred,direct_pred);
 EXECUTE format('CREATE POLICY "Direct manager delete guard" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',t,direct_pred);
 EXECUTE format('CREATE POLICY "Managers read reporting scope" ON public.%I FOR SELECT TO authenticated USING (%I IN (SELECT unnest(public.get_reporting_scope((SELECT auth.uid())))))',t,c);
END LOOP;
END $$;