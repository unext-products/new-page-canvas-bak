
-- Allow HODs to update timesheet entries for users in their department (for approvals)
CREATE POLICY "HODs can update entries in their department"
ON public.timesheet_entries
FOR UPDATE
USING (
  get_user_role(auth.uid()) = 'hod'::app_role
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = timesheet_entries.user_id
    AND ur.department_id = get_user_department(auth.uid())
  )
);
