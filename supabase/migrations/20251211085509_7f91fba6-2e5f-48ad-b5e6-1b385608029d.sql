
-- Allow HODs to view user_roles for users in their department
CREATE POLICY "HODs can view user roles in their department"
ON public.user_roles
FOR SELECT
USING (
  get_user_role(auth.uid()) = 'hod'::app_role
  AND department_id = get_user_department(auth.uid())
);
