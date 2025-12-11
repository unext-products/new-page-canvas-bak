-- Allow HODs to view profiles of users in their department
CREATE POLICY "HODs can view profiles in their department" 
ON public.profiles 
FOR SELECT 
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role) 
  AND (
    EXISTS (
      SELECT 1 
      FROM user_roles ur 
      WHERE ur.user_id = profiles.id 
      AND ur.department_id = get_user_department(auth.uid())
    )
  )
);