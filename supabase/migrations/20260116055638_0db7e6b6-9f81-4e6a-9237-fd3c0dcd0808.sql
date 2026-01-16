-- Fix Programs RLS policies to use vertical_id instead of department_id

-- Drop existing policies
DROP POLICY IF EXISTS "Org admins can manage programs" ON programs;
DROP POLICY IF EXISTS "Users can view programs" ON programs;

-- Create fixed policy for org admins - check vertical_id against verticals table
CREATE POLICY "Org admins can manage programs" ON programs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM verticals v 
    WHERE v.id = programs.vertical_id 
    AND v.organization_id = get_user_organization(auth.uid())
  ) 
  AND get_user_role(auth.uid()) = 'org_admin'::app_role
);

-- Create fixed SELECT policy for all users - check vertical_id against verticals table
CREATE POLICY "Users can view programs" ON programs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM verticals v 
    WHERE v.id = programs.vertical_id 
    AND v.organization_id = get_user_organization(auth.uid())
  )
);