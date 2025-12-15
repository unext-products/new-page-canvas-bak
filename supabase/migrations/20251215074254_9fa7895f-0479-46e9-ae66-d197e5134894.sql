
-- Phase 1: Add unique constraints to junction tables (if not exists)
-- and migrate existing data from user_roles

-- First, add unique constraint on user_departments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_departments_user_id_department_id_key'
  ) THEN
    ALTER TABLE public.user_departments 
    ADD CONSTRAINT user_departments_user_id_department_id_key 
    UNIQUE (user_id, department_id);
  END IF;
END $$;

-- Add unique constraint on user_programs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_programs_user_id_program_id_key'
  ) THEN
    ALTER TABLE public.user_programs 
    ADD CONSTRAINT user_programs_user_id_program_id_key 
    UNIQUE (user_id, program_id);
  END IF;
END $$;

-- Migrate existing department assignments from user_roles to user_departments
INSERT INTO public.user_departments (user_id, department_id)
SELECT user_id, department_id FROM public.user_roles 
WHERE department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;

-- Migrate existing program assignments from user_roles to user_programs
INSERT INTO public.user_programs (user_id, program_id)
SELECT user_id, program_id FROM public.user_roles 
WHERE program_id IS NOT NULL
ON CONFLICT (user_id, program_id) DO NOTHING;

-- Phase 2: Create new helper functions for multi-department/program support

-- Returns all department IDs for a user as an array
CREATE OR REPLACE FUNCTION public.get_user_departments(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(department_id),
    ARRAY[]::uuid[]
  )
  FROM public.user_departments
  WHERE user_id = p_user_id;
$$;

-- Check if user belongs to a specific department
CREATE OR REPLACE FUNCTION public.user_in_department(p_user_id uuid, p_department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_departments
    WHERE user_id = p_user_id AND department_id = p_department_id
  );
$$;

-- Returns all program IDs for a user as an array
CREATE OR REPLACE FUNCTION public.get_user_programs(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(program_id),
    ARRAY[]::uuid[]
  )
  FROM public.user_programs
  WHERE user_id = p_user_id;
$$;

-- Check if user belongs to a specific program
CREATE OR REPLACE FUNCTION public.user_in_program(p_user_id uuid, p_program_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_programs
    WHERE user_id = p_user_id AND program_id = p_program_id
  );
$$;

-- Phase 3: Update RLS policies to use junction tables

-- Update leave_days HOD policy to use junction table
DROP POLICY IF EXISTS "HODs can view department leaves" ON public.leave_days;
CREATE POLICY "HODs can view department leaves" 
ON public.leave_days 
FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = leave_days.user_id 
    AND ud.department_id = ANY(get_user_departments(auth.uid()))
  )
);

-- Update profiles HOD policy to use junction table
DROP POLICY IF EXISTS "HODs can view profiles in their department" ON public.profiles;
CREATE POLICY "HODs can view profiles in their department" 
ON public.profiles 
FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = profiles.id 
    AND ud.department_id = ANY(get_user_departments(auth.uid()))
  )
);

-- Update timesheet_entries HOD view policy
DROP POLICY IF EXISTS "HODs can view department entries" ON public.timesheet_entries;
CREATE POLICY "HODs can view department entries" 
ON public.timesheet_entries 
FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = timesheet_entries.user_id 
    AND ud.department_id = ANY(get_user_departments(auth.uid()))
  )
);

-- Update timesheet_entries HOD update policy
DROP POLICY IF EXISTS "HODs can update entries in their department" ON public.timesheet_entries;
CREATE POLICY "HODs can update entries in their department" 
ON public.timesheet_entries 
FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = timesheet_entries.user_id 
    AND ud.department_id = ANY(get_user_departments(auth.uid()))
  )
);

-- Update user_roles HOD view policy
DROP POLICY IF EXISTS "HODs can view user roles in their department" ON public.user_roles;
CREATE POLICY "HODs can view user roles in their department" 
ON public.user_roles 
FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = user_roles.user_id 
    AND ud.department_id = ANY(get_user_departments(auth.uid()))
  )
);
