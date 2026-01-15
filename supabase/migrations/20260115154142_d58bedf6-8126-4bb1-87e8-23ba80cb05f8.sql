
-- Phase 1B: Create tables, functions, migrate data, and RLS policies

-- 1.1 Create organization_role_labels table for customizable role names
CREATE TABLE IF NOT EXISTS public.organization_role_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role_super_admin TEXT NOT NULL DEFAULT 'Super Admin',
  role_admin TEXT NOT NULL DEFAULT 'Admin',
  role_l3 TEXT NOT NULL DEFAULT 'L3',
  role_l2 TEXT NOT NULL DEFAULT 'L2',
  role_l1 TEXT NOT NULL DEFAULT 'L1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS on organization_role_labels
ALTER TABLE public.organization_role_labels ENABLE ROW LEVEL SECURITY;

-- 1.2 Create helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role = 'super_admin'
  );
$$;

-- 1.3 Create helper function to get user's role level for comparison
CREATE OR REPLACE FUNCTION public.get_role_level(p_role app_role)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
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

-- 1.4 Migrate existing roles to new roles
UPDATE public.user_roles SET role = 'l3' WHERE role = 'hod';
UPDATE public.user_roles SET role = 'l1' WHERE role = 'faculty';
UPDATE public.user_roles SET role = 'l2' WHERE role = 'program_manager';

-- 1.5 RLS Policies for organization_role_labels table
CREATE POLICY "Super admins can manage all role labels"
ON public.organization_role_labels FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their role labels"
ON public.organization_role_labels FOR ALL
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND get_user_role(auth.uid()) = 'org_admin'
);

CREATE POLICY "Users can view their org role labels"
ON public.organization_role_labels FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- 1.6 Super admin policies for verticals
CREATE POLICY "Super admins can view all verticals"
ON public.verticals FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all verticals"
ON public.verticals FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.7 Super admin policies for organizations
CREATE POLICY "Super admins can view all organizations"
ON public.organizations FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all organizations"
ON public.organizations FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.8 Super admin policies for profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
USING (is_super_admin(auth.uid()));

-- 1.9 Super admin policies for user_roles
CREATE POLICY "Super admins can view all user roles"
ON public.user_roles FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all user roles"
ON public.user_roles FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.10 Super admin policies for programs
CREATE POLICY "Super admins can view all programs"
ON public.programs FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all programs"
ON public.programs FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.11 Super admin policies for batches
CREATE POLICY "Super admins can view all batches"
ON public.batches FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all batches"
ON public.batches FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.12 Super admin policies for terms
CREATE POLICY "Super admins can view all terms"
ON public.terms FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all terms"
ON public.terms FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.13 Super admin policies for subjects
CREATE POLICY "Super admins can view all subjects"
ON public.subjects FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all subjects"
ON public.subjects FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.14 Super admin policies for departments
CREATE POLICY "Super admins can view all departments"
ON public.departments FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all departments"
ON public.departments FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.15 Drop old HOD policies from timesheet_entries
DROP POLICY IF EXISTS "HODs can view department entries" ON public.timesheet_entries;
DROP POLICY IF EXISTS "HODs can update entries in their department" ON public.timesheet_entries;

-- 1.16 Super admin policies for timesheet_entries
CREATE POLICY "Super admins can view all timesheet entries"
ON public.timesheet_entries FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all timesheet entries"
ON public.timesheet_entries FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.17 L3 policies for timesheet_entries
CREATE POLICY "L3 can view entries in their verticals"
ON public.timesheet_entries FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l3' 
  AND EXISTS (
    SELECT 1 FROM user_verticals uv
    WHERE uv.user_id = auth.uid() 
    AND uv.vertical_id = timesheet_entries.vertical_id
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = timesheet_entries.user_id 
    AND ur.role IN ('l1', 'l2')
  )
);

CREATE POLICY "L3 can update entries in their verticals"
ON public.timesheet_entries FOR UPDATE
USING (
  get_user_role(auth.uid()) = 'l3' 
  AND EXISTS (
    SELECT 1 FROM user_verticals uv
    WHERE uv.user_id = auth.uid() 
    AND uv.vertical_id = timesheet_entries.vertical_id
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = timesheet_entries.user_id 
    AND ur.role IN ('l1', 'l2')
  )
);

-- 1.18 L2 policies for timesheet_entries
CREATE POLICY "L2 can view L1 entries in their programs"
ON public.timesheet_entries FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l2' 
  AND EXISTS (
    SELECT 1 FROM user_programs up
    WHERE up.user_id = auth.uid() 
    AND up.program_id = timesheet_entries.program_id
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = timesheet_entries.user_id 
    AND ur.role = 'l1'
  )
);

CREATE POLICY "L2 can update L1 entries in their programs"
ON public.timesheet_entries FOR UPDATE
USING (
  get_user_role(auth.uid()) = 'l2' 
  AND EXISTS (
    SELECT 1 FROM user_programs up
    WHERE up.user_id = auth.uid() 
    AND up.program_id = timesheet_entries.program_id
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = timesheet_entries.user_id 
    AND ur.role = 'l1'
  )
);

-- 1.19 Admin policies for L3 entries
CREATE POLICY "Admin can view L3 entries in their org"
ON public.timesheet_entries FOR SELECT
USING (
  get_user_role(auth.uid()) = 'org_admin' 
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = timesheet_entries.user_id 
    AND ur.organization_id = get_user_organization(auth.uid())
    AND ur.role = 'l3'
  )
);

CREATE POLICY "Admin can update L3 entries in their org"
ON public.timesheet_entries FOR UPDATE
USING (
  get_user_role(auth.uid()) = 'org_admin' 
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = timesheet_entries.user_id 
    AND ur.organization_id = get_user_organization(auth.uid())
    AND ur.role = 'l3'
  )
);

-- 1.20 Update user_verticals RLS for new roles
DROP POLICY IF EXISTS "HODs can view vertical assignments in their verticals" ON public.user_verticals;

CREATE POLICY "L3 can view vertical assignments in their verticals"
ON public.user_verticals FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l3' 
  AND vertical_id = ANY(get_user_verticals(auth.uid()))
);

CREATE POLICY "Super admins can manage all vertical assignments"
ON public.user_verticals FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.21 Update user_departments RLS for new roles
DROP POLICY IF EXISTS "HODs can view department assignments in their departments" ON public.user_departments;

CREATE POLICY "L3 can view department assignments in their departments"
ON public.user_departments FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l3' 
  AND department_id = ANY(get_user_departments(auth.uid()))
);

CREATE POLICY "Super admins can manage all department assignments"
ON public.user_departments FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.22 Update user_roles RLS for new roles
DROP POLICY IF EXISTS "HODs can view user roles in their department" ON public.user_roles;

CREATE POLICY "L3 can view user roles in their verticals"
ON public.user_roles FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l3' 
  AND EXISTS (
    SELECT 1 FROM user_verticals uv
    WHERE uv.user_id = user_roles.user_id 
    AND uv.vertical_id = ANY(get_user_verticals(auth.uid()))
  )
);

-- 1.23 Update profiles RLS for new roles
DROP POLICY IF EXISTS "HODs can view profiles in their department" ON public.profiles;

CREATE POLICY "L3 can view profiles in their verticals"
ON public.profiles FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l3' 
  AND EXISTS (
    SELECT 1 FROM user_verticals uv
    WHERE uv.user_id = profiles.id 
    AND uv.vertical_id = ANY(get_user_verticals(auth.uid()))
  )
);

CREATE POLICY "L2 can view L1 profiles in their programs"
ON public.profiles FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l2' 
  AND EXISTS (
    SELECT 1 FROM user_programs up
    JOIN user_roles ur ON ur.user_id = up.user_id
    WHERE up.user_id = profiles.id 
    AND up.program_id = ANY(get_user_programs(auth.uid()))
    AND ur.role = 'l1'
  )
);

-- 1.24 Update leave_days RLS for new roles
DROP POLICY IF EXISTS "HODs can view department leaves" ON public.leave_days;

CREATE POLICY "L3 can view leaves in their verticals"
ON public.leave_days FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l3' 
  AND EXISTS (
    SELECT 1 FROM user_verticals uv
    WHERE uv.user_id = leave_days.user_id 
    AND uv.vertical_id = ANY(get_user_verticals(auth.uid()))
  )
);

CREATE POLICY "Super admins can view all leaves"
ON public.leave_days FOR SELECT
USING (is_super_admin(auth.uid()));

-- 1.25 Update user_settings RLS for new roles
DROP POLICY IF EXISTS "HODs can manage user settings in their departments" ON public.user_settings;

CREATE POLICY "L3 can manage user settings in their verticals"
ON public.user_settings FOR ALL
USING (
  get_user_role(auth.uid()) = 'l3' 
  AND vertical_id = ANY(get_user_verticals(auth.uid()))
);

CREATE POLICY "Super admins can manage all user settings"
ON public.user_settings FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.26 Super admin policies for junction tables
CREATE POLICY "Super admins can manage all program assignments"
ON public.user_programs FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all batch assignments"
ON public.user_batches FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage all subject assignments"
ON public.user_subjects FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.27 Super admin policies for activity_categories
CREATE POLICY "Super admins can manage all activity categories"
ON public.activity_categories FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.28 Super admin policies for organization_labels
CREATE POLICY "Super admins can manage all organization labels"
ON public.organization_labels FOR ALL
USING (is_super_admin(auth.uid()));

-- 1.29 Super admin policies for settings
CREATE POLICY "Super admins can manage all settings"
ON public.settings FOR ALL
USING (is_super_admin(auth.uid()));
