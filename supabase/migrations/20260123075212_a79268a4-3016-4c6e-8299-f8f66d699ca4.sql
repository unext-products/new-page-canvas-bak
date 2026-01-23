-- Add back L2 policies using SECURITY DEFINER functions to avoid recursion
-- The get_user_verticals() and get_user_role() functions are already SECURITY DEFINER

-- L2 can view user_verticals for users in their assigned verticals
CREATE POLICY "L2 can view user_verticals in their assigned verticals"
ON public.user_verticals FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l2'::app_role
  AND vertical_id = ANY(get_user_verticals(auth.uid()))
);

-- L2 can view user_roles for users in their assigned verticals  
CREATE POLICY "L2 can view user_roles in their assigned verticals"
ON public.user_roles FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l2'::app_role
  AND EXISTS (
    SELECT 1 FROM public.user_verticals uv
    WHERE uv.user_id = user_roles.user_id
    AND uv.vertical_id = ANY(get_user_verticals(auth.uid()))
  )
);