
-- 1. Add INSERT policy on profiles: only allow inserting own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid());

-- 2. Fix user_roles: add explicit INSERT restriction for non-admins
-- The existing "Org admins can manage user roles" ALL policy allows org_admins.
-- The existing "Super admins can manage all user roles" ALL policy allows super_admins.
-- We need to ensure non-admin users CANNOT insert roles.
-- Add a restrictive default-deny by ensuring only admins can insert.
-- Drop and recreate the org admin policy with proper WITH CHECK
DROP POLICY IF EXISTS "Org admins can manage user roles" ON public.user_roles;
CREATE POLICY "Org admins can manage user roles"
ON public.user_roles
FOR ALL
USING (get_user_role(auth.uid()) = 'org_admin'::app_role)
WITH CHECK (
  get_user_role(auth.uid()) = 'org_admin'::app_role
  AND role != 'super_admin'::app_role
);

-- 3. Fix settings table: replace overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view settings" ON public.settings;
CREATE POLICY "Users can view settings in their org"
ON public.settings
FOR SELECT
USING (
  department_id IS NULL AND vertical_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = settings.department_id
    AND d.organization_id = get_user_organization(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.verticals v
    WHERE v.id = settings.vertical_id
    AND v.organization_id = get_user_organization(auth.uid())
  )
);
