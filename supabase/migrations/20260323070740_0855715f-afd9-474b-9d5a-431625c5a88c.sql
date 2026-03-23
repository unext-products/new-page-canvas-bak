-- Allow org admins to delete leave entries for users in their organization
CREATE POLICY "Org admins can delete leaves in their org"
ON public.leave_days FOR DELETE
TO authenticated
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = leave_days.user_id
    AND ur.organization_id = get_user_organization(auth.uid())
  )
);

-- Allow super admins to delete any leave
CREATE POLICY "Super admins can delete leaves"
ON public.leave_days FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));