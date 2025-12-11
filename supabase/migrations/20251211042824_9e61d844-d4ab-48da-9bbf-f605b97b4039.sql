-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Org admins can view all profiles" ON public.profiles;

-- Create a new policy that restricts org_admins to profiles within their organization
CREATE POLICY "Org admins can view profiles in their org" 
ON public.profiles 
FOR SELECT 
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role) 
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = profiles.id 
      AND ur.organization_id = get_user_organization(auth.uid())
    )
  )
);