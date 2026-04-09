CREATE POLICY "L2 can view profiles in their verticals"
ON public.profiles FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'l2'::app_role) 
  AND EXISTS (
    SELECT 1 FROM user_verticals uv 
    WHERE uv.user_id = profiles.id 
    AND uv.vertical_id = ANY(get_user_verticals(auth.uid()))
  )
);