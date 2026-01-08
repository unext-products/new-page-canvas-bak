-- Add RLS policy for org_admin to view all leave days in their organization
CREATE POLICY "Admins can view all leaves"
ON public.leave_days
FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = 'org_admin'::app_role);