CREATE OR REPLACE FUNCTION public.get_team_reporting_links(p_manager_id uuid)
RETURNS TABLE(user_id uuid, manager_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH target AS (
 SELECT ur.role,ur.organization_id FROM public.user_roles ur WHERE ur.user_id=p_manager_id AND (p_manager_id=auth.uid() OR public.is_super_admin(auth.uid()) OR (public.get_user_role(auth.uid())='org_admin' AND ur.organization_id=public.get_user_organization(auth.uid())))
), scope AS (
 SELECT unnest(public.get_reporting_scope(p_manager_id)) AS id
 UNION
 SELECT ur.user_id FROM target t JOIN public.user_roles ur ON ur.organization_id=t.organization_id WHERE t.role='org_admin' AND ur.role<>'super_admin' AND ur.user_id<>p_manager_id
)
SELECT DISTINCT rh.user_id,rh.manager_id FROM public.reporting_hierarchy rh JOIN scope s ON s.id=rh.user_id
WHERE EXISTS(SELECT 1 FROM target) AND (rh.manager_id=p_manager_id OR rh.manager_id IN (SELECT id FROM scope));
$$;
REVOKE ALL ON FUNCTION public.get_team_reporting_links(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_team_reporting_links(uuid) TO authenticated,service_role;