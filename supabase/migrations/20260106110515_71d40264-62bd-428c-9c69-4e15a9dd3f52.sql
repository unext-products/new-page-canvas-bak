-- Add RLS policy for org_admins to update timesheet entries in their organization
CREATE POLICY "Org admins can update entries in their org"
ON public.timesheet_entries
FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role) 
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = timesheet_entries.user_id 
      AND ur.organization_id = get_user_organization(auth.uid())
    )
  )
);