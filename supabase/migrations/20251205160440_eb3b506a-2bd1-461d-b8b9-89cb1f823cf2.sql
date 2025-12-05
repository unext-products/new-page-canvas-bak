-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new policy allowing org_admins to update any profile
CREATE POLICY "Users can update profiles based on role"
ON public.profiles
FOR UPDATE
USING (
  (id = auth.uid())
  OR
  (get_user_role(auth.uid()) = 'org_admin'::app_role)
);