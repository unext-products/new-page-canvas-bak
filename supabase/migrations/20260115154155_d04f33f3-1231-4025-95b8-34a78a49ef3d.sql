
-- Fix function search path warning
CREATE OR REPLACE FUNCTION public.get_role_level(p_role app_role)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_role
    WHEN 'super_admin' THEN 5
    WHEN 'org_admin' THEN 4
    WHEN 'l3' THEN 3
    WHEN 'l2' THEN 2
    WHEN 'l1' THEN 1
    WHEN 'hod' THEN 3
    WHEN 'program_manager' THEN 2
    WHEN 'faculty' THEN 1
    ELSE 0
  END;
$$;
