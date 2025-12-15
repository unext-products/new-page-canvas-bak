-- Allow HODs to view user_departments entries for users in their same departments
CREATE POLICY "HODs can view department assignments in their departments"
ON public.user_departments
FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role) 
  AND 
  (department_id = ANY(get_user_departments(auth.uid())))
);