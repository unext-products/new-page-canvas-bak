-- Add RLS policy for L2 users to view user_verticals for users in their verticals
CREATE POLICY "L2 can view vertical assignments in their verticals"
ON public.user_verticals FOR SELECT
TO authenticated
USING (
  (public.get_user_role(auth.uid()) = 'l2'::app_role) 
  AND (
    vertical_id IN (
      SELECT uv.vertical_id 
      FROM public.user_verticals uv 
      WHERE uv.user_id = auth.uid()
    )
  )
);

-- Add RLS policy for L2 users to view user_roles in their verticals (to see team members)
CREATE POLICY "L2 can view user roles in their verticals"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  (public.get_user_role(auth.uid()) = 'l2'::app_role) 
  AND (
    EXISTS (
      SELECT 1 
      FROM public.user_verticals uv
      WHERE uv.user_id = user_roles.user_id 
      AND uv.vertical_id = ANY (public.get_user_verticals(auth.uid()))
    )
  )
);

-- Add RLS policy for L2 to view profiles in their verticals
CREATE POLICY "L2 can view profiles in their verticals"
ON public.profiles FOR SELECT
TO authenticated
USING (
  (public.get_user_role(auth.uid()) = 'l2'::app_role) 
  AND (
    EXISTS (
      SELECT 1 
      FROM public.user_verticals uv
      WHERE uv.user_id = profiles.id 
      AND uv.vertical_id = ANY (public.get_user_verticals(auth.uid()))
    )
  )
);

-- Add RLS policy for L2 to view leave_days in their verticals
CREATE POLICY "L2 can view leaves in their verticals"
ON public.leave_days FOR SELECT
TO authenticated
USING (
  (public.get_user_role(auth.uid()) = 'l2'::app_role) 
  AND (
    EXISTS (
      SELECT 1 
      FROM public.user_verticals uv
      WHERE uv.user_id = leave_days.user_id 
      AND uv.vertical_id = ANY (public.get_user_verticals(auth.uid()))
    )
  )
);

-- Add RLS policy for L2 to view timesheet entries in their verticals (L1 users only)
CREATE POLICY "L2 can view entries in their verticals"
ON public.timesheet_entries FOR SELECT
TO authenticated
USING (
  (public.get_user_role(auth.uid()) = 'l2'::app_role) 
  AND (
    EXISTS (
      SELECT 1 
      FROM public.user_verticals uv
      WHERE uv.user_id = timesheet_entries.user_id 
      AND uv.vertical_id = ANY (public.get_user_verticals(auth.uid()))
    )
  )
  AND (
    EXISTS (
      SELECT 1 
      FROM public.user_roles ur
      WHERE ur.user_id = timesheet_entries.user_id 
      AND ur.role = 'l1'::app_role
    )
  )
);

-- Add RLS policy for L2 to update timesheet entries in their verticals (for approvals)
CREATE POLICY "L2 can update entries in their verticals"
ON public.timesheet_entries FOR UPDATE
TO authenticated
USING (
  (public.get_user_role(auth.uid()) = 'l2'::app_role) 
  AND (
    EXISTS (
      SELECT 1 
      FROM public.user_verticals uv
      WHERE uv.user_id = timesheet_entries.user_id 
      AND uv.vertical_id = ANY (public.get_user_verticals(auth.uid()))
    )
  )
  AND (
    EXISTS (
      SELECT 1 
      FROM public.user_roles ur
      WHERE ur.user_id = timesheet_entries.user_id 
      AND ur.role = 'l1'::app_role
    )
  )
);