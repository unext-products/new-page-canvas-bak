-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view roles in their scope" ON public.user_roles;

-- Create updated policy that allows HODs and program managers to see their department members
CREATE POLICY "Users can view roles in their scope" 
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid() OR 
  get_user_role(auth.uid()) = 'org_admin'::app_role OR
  get_user_role(auth.uid()) = 'program_manager'::app_role OR
  (get_user_role(auth.uid()) = 'hod'::app_role AND department_id = get_user_department(auth.uid()))
);