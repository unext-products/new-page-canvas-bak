-- Drop remaining L2 recursive policy on user_roles
DROP POLICY IF EXISTS "L2 can view user roles in their verticals" ON public.user_roles;