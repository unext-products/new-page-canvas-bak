DROP POLICY "Org admins can manage categories" ON public.activity_categories;

CREATE POLICY "Org admins can manage categories"
ON public.activity_categories FOR ALL
TO public
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role)
  AND (organization_id = get_user_organization(auth.uid()))
);