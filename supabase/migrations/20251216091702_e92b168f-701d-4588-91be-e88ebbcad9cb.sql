-- Add RLS policy for org_admins to update profiles in their organization
CREATE POLICY "Org admins can update profiles in their org"
ON public.profiles
FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role) 
  AND 
  (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = profiles.id 
    AND ur.organization_id = get_user_organization(auth.uid())
  ))
);