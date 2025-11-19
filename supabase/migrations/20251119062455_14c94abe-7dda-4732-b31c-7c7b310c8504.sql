-- Migration 3: Data migration and RLS policy updates

-- Step 1: Create a default organization for existing data
INSERT INTO public.organizations (id, name, code)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Default Organization',
  'DEFAULT_ORG'
)
ON CONFLICT (code) DO NOTHING;

-- Step 2: Update existing departments to belong to the default organization
UPDATE public.departments
SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID
WHERE organization_id IS NULL;

-- Step 3: Update all existing user_roles to belong to the default organization
UPDATE public.user_roles
SET organization_id = '00000000-0000-0000-0000-000000000001'::UUID
WHERE organization_id IS NULL;

-- Step 4: Migrate existing 'admin' users to 'org_admin'
UPDATE public.user_roles
SET role = 'org_admin'
WHERE role = 'admin';

-- Step 5: Create helper functions for hierarchical role checking
CREATE OR REPLACE FUNCTION public.get_user_organization(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT organization_id FROM public.user_roles WHERE user_roles.user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_program(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT program_id FROM public.user_roles WHERE user_roles.user_id = $1;
$$;

-- Step 6: Update RLS policies for hierarchical access

-- Departments policies
DROP POLICY IF EXISTS "Only admins can delete departments" ON public.departments;
DROP POLICY IF EXISTS "Only admins can insert departments" ON public.departments;
DROP POLICY IF EXISTS "Only admins can update departments" ON public.departments;

CREATE POLICY "Org admins and program managers can insert departments"
  ON public.departments
  FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) IN ('org_admin', 'program_manager')
  );

CREATE POLICY "Org admins and program managers can update departments"
  ON public.departments
  FOR UPDATE
  USING (
    get_user_role(auth.uid()) IN ('org_admin', 'program_manager')
  );

CREATE POLICY "Org admins and program managers can delete departments"
  ON public.departments
  FOR DELETE
  USING (
    get_user_role(auth.uid()) IN ('org_admin', 'program_manager')
  );

-- User roles policies
DROP POLICY IF EXISTS "Only admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

CREATE POLICY "Users can view roles in their scope"
  ON public.user_roles
  FOR SELECT
  USING (
    user_id = auth.uid() OR 
    get_user_role(auth.uid()) = 'org_admin'
  );

CREATE POLICY "Org admins can manage user roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'org_admin');

CREATE POLICY "Org admins can update user roles"
  ON public.user_roles
  FOR UPDATE
  USING (get_user_role(auth.uid()) = 'org_admin');

CREATE POLICY "Org admins can delete user roles"
  ON public.user_roles
  FOR DELETE
  USING (get_user_role(auth.uid()) = 'org_admin');

-- Profiles policies
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their department" ON public.profiles;

CREATE POLICY "Org admins can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'org_admin');

CREATE POLICY "Users can view profiles based on hierarchy"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid() OR
    get_user_role(auth.uid()) = 'org_admin' OR
    (get_user_role(auth.uid()) = 'hod' AND get_user_department(id) = get_user_department(auth.uid()))
  );

-- Settings policies
DROP POLICY IF EXISTS "Only admins can update settings" ON public.settings;

CREATE POLICY "Org admins can update settings"
  ON public.settings
  FOR UPDATE
  USING (get_user_role(auth.uid()) = 'org_admin');

-- Timesheet entries policies
DROP POLICY IF EXISTS "Faculty can update their own draft entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "Faculty can view their own entries" ON public.timesheet_entries;

CREATE POLICY "Users can update entries based on role"
  ON public.timesheet_entries
  FOR UPDATE
  USING (
    (user_id = auth.uid() AND status = 'draft') OR
    (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid())) OR
    get_user_role(auth.uid()) IN ('org_admin', 'program_manager')
  );

CREATE POLICY "Users can view entries based on hierarchy"
  ON public.timesheet_entries
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    get_user_role(auth.uid()) = 'org_admin' OR
    (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid()))
  );

-- Leave days policies
DROP POLICY IF EXISTS "Admin can view all leaves" ON public.leave_days;
DROP POLICY IF EXISTS "HOD can view department leaves" ON public.leave_days;

CREATE POLICY "Users can view leaves based on hierarchy"
  ON public.leave_days
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    get_user_role(auth.uid()) = 'org_admin' OR
    (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid()))
  );