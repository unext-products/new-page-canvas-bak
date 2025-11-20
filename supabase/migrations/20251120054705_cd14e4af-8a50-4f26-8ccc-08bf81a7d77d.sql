-- Step 1: Drop the program_id column from departments (departments belong to org, not programs)
ALTER TABLE public.departments DROP COLUMN IF EXISTS program_id;

-- Step 2: Modify programs table structure (programs belong to departments now)
ALTER TABLE public.programs DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE;

-- Step 3: Update helper functions to traverse new hierarchy

-- Update get_user_organization to traverse program -> department -> organization
CREATE OR REPLACE FUNCTION public.get_user_organization(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT COALESCE(
    -- First try direct organization_id
    (SELECT organization_id FROM public.user_roles WHERE user_roles.user_id = $1),
    -- If user is assigned to a department, get org from department
    (SELECT d.organization_id 
     FROM public.user_roles ur
     JOIN public.departments d ON d.id = ur.department_id
     WHERE ur.user_id = $1),
    -- If user is assigned to a program, traverse program -> department -> org
    (SELECT d.organization_id
     FROM public.user_roles ur
     JOIN public.programs p ON p.id = ur.program_id
     JOIN public.departments d ON d.id = p.department_id
     WHERE ur.user_id = $1)
  );
$function$;

-- Update get_user_department to traverse program -> department
CREATE OR REPLACE FUNCTION public.get_user_department(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT COALESCE(
    -- First try direct department_id
    (SELECT department_id FROM public.user_roles WHERE user_roles.user_id = $1),
    -- If user is assigned to a program, get department from program
    (SELECT p.department_id
     FROM public.user_roles ur
     JOIN public.programs p ON p.id = ur.program_id
     WHERE ur.user_id = $1)
  );
$function$;

-- Create new helper function to get department's organization
CREATE OR REPLACE FUNCTION public.get_department_organization(dept_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT organization_id FROM public.departments WHERE id = $1;
$function$;

-- Step 4: Update RLS policies for new hierarchy

-- Update departments policies to ensure org_admin can only manage departments in their org
DROP POLICY IF EXISTS "Org admins and program managers can insert departments" ON public.departments;
CREATE POLICY "Org admins and program managers can insert departments" 
ON public.departments 
FOR INSERT 
WITH CHECK (
  (get_user_role(auth.uid()) = 'org_admin' AND organization_id = get_user_organization(auth.uid()))
  OR
  (get_user_role(auth.uid()) = 'program_manager')
);

DROP POLICY IF EXISTS "Org admins and program managers can update departments" ON public.departments;
CREATE POLICY "Org admins and program managers can update departments" 
ON public.departments 
FOR UPDATE 
USING (
  (get_user_role(auth.uid()) = 'org_admin' AND organization_id = get_user_organization(auth.uid()))
  OR
  (get_user_role(auth.uid()) = 'program_manager')
);

DROP POLICY IF EXISTS "Org admins and program managers can delete departments" ON public.departments;
CREATE POLICY "Org admins and program managers can delete departments" 
ON public.departments 
FOR DELETE 
USING (
  (get_user_role(auth.uid()) = 'org_admin' AND organization_id = get_user_organization(auth.uid()))
  OR
  (get_user_role(auth.uid()) = 'program_manager')
);

-- Update programs policies for new hierarchy (programs belong to departments)
DROP POLICY IF EXISTS "Org admins and program managers can insert programs" ON public.programs;
CREATE POLICY "Org admins and program managers can insert programs" 
ON public.programs 
FOR INSERT 
WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY['org_admin'::app_role, 'program_manager'::app_role])
);

DROP POLICY IF EXISTS "Org admins and program managers can update programs" ON public.programs;
CREATE POLICY "Org admins and program managers can update programs" 
ON public.programs 
FOR UPDATE 
USING (
  get_user_role(auth.uid()) = ANY (ARRAY['org_admin'::app_role, 'program_manager'::app_role])
);

DROP POLICY IF EXISTS "Org admins and program managers can delete programs" ON public.programs;
CREATE POLICY "Org admins and program managers can delete programs" 
ON public.programs 
FOR DELETE 
USING (
  get_user_role(auth.uid()) = ANY (ARRAY['org_admin'::app_role, 'program_manager'::app_role])
);

-- Update organizations policies to prevent org_admins from creating/deleting orgs
DROP POLICY IF EXISTS "Only org admins can insert organizations" ON public.organizations;
-- No insert policy means no one can create organizations via the app

DROP POLICY IF EXISTS "Only org admins can delete organizations" ON public.organizations;
-- No delete policy means no one can delete organizations via the app

-- Keep update policy for org_admins to edit their own org
DROP POLICY IF EXISTS "Only org admins can update organizations" ON public.organizations;
CREATE POLICY "Org admins can update their own organization" 
ON public.organizations 
FOR UPDATE 
USING (
  get_user_role(auth.uid()) = 'org_admin' AND id = get_user_organization(auth.uid())
);