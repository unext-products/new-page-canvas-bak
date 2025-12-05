-- Phase 1: Create helper function to check if target user is in same organization
CREATE OR REPLACE FUNCTION public.is_same_organization(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    get_user_organization(target_user_id) = get_user_organization(auth.uid()),
    false
  );
$$;

-- Phase 2: Fix profiles Table RLS
DROP POLICY IF EXISTS "Users can view profiles based on hierarchy" ON public.profiles;

CREATE POLICY "Users can view profiles based on hierarchy"
ON public.profiles FOR SELECT TO authenticated
USING (
  (id = auth.uid()) OR 
  ((get_user_role(auth.uid()) = 'org_admin') AND is_same_organization(id)) OR
  ((get_user_role(auth.uid()) = 'hod') AND (get_user_department(id) = get_user_department(auth.uid())))
);

-- Phase 3: Fix user_roles Table RLS
DROP POLICY IF EXISTS "Users can view roles in their scope" ON public.user_roles;

CREATE POLICY "Users can view roles in their scope"
ON public.user_roles FOR SELECT TO authenticated
USING (
  (user_id = auth.uid()) OR
  ((get_user_role(auth.uid()) = 'org_admin') AND (organization_id = get_user_organization(auth.uid()))) OR
  ((get_user_role(auth.uid()) = 'program_manager') AND (organization_id = get_user_organization(auth.uid()))) OR
  ((get_user_role(auth.uid()) = 'hod') AND (department_id = get_user_department(auth.uid())))
);

-- Phase 4: Fix programs Table RLS
DROP POLICY IF EXISTS "Anyone authenticated can view programs" ON public.programs;

CREATE POLICY "Users can view programs in their organization"
ON public.programs FOR SELECT TO authenticated
USING (
  department_id IN (
    SELECT id FROM departments 
    WHERE organization_id = get_user_organization(auth.uid())
  )
);

-- Also fix UPDATE and DELETE for program_manager to scope to organization
DROP POLICY IF EXISTS "Org admins and program managers can update programs" ON public.programs;
DROP POLICY IF EXISTS "Org admins and program managers can delete programs" ON public.programs;
DROP POLICY IF EXISTS "Org admins and program managers can insert programs" ON public.programs;

CREATE POLICY "Org admins and program managers can insert programs"
ON public.programs FOR INSERT TO authenticated
WITH CHECK (
  (get_user_role(auth.uid()) IN ('org_admin', 'program_manager')) AND
  department_id IN (
    SELECT id FROM departments 
    WHERE organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Org admins and program managers can update programs"
ON public.programs FOR UPDATE TO authenticated
USING (
  (get_user_role(auth.uid()) IN ('org_admin', 'program_manager')) AND
  department_id IN (
    SELECT id FROM departments 
    WHERE organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Org admins and program managers can delete programs"
ON public.programs FOR DELETE TO authenticated
USING (
  (get_user_role(auth.uid()) IN ('org_admin', 'program_manager')) AND
  department_id IN (
    SELECT id FROM departments 
    WHERE organization_id = get_user_organization(auth.uid())
  )
);

-- Phase 5: Fix timesheet_entries Table RLS
DROP POLICY IF EXISTS "Users can view entries based on hierarchy" ON public.timesheet_entries;

CREATE POLICY "Users can view entries based on hierarchy"
ON public.timesheet_entries FOR SELECT TO authenticated
USING (
  (user_id = auth.uid()) OR
  ((get_user_role(auth.uid()) = 'org_admin') AND 
   department_id IN (SELECT id FROM departments WHERE organization_id = get_user_organization(auth.uid()))) OR
  ((get_user_role(auth.uid()) = 'hod') AND (department_id = get_user_department(auth.uid())))
);

DROP POLICY IF EXISTS "Users can update entries based on role" ON public.timesheet_entries;

CREATE POLICY "Users can update entries based on role"
ON public.timesheet_entries FOR UPDATE TO authenticated
USING (
  ((user_id = auth.uid()) AND (status = 'draft')) OR
  ((get_user_role(auth.uid()) = 'hod') AND (department_id = get_user_department(auth.uid()))) OR
  ((get_user_role(auth.uid()) IN ('org_admin', 'program_manager')) AND 
   department_id IN (SELECT id FROM departments WHERE organization_id = get_user_organization(auth.uid())))
);

-- Phase 6: Fix leave_days Table RLS
DROP POLICY IF EXISTS "Users can view leaves based on hierarchy" ON public.leave_days;

CREATE POLICY "Users can view leaves based on hierarchy"
ON public.leave_days FOR SELECT TO authenticated
USING (
  (user_id = auth.uid()) OR
  ((get_user_role(auth.uid()) = 'org_admin') AND 
   department_id IN (SELECT id FROM departments WHERE organization_id = get_user_organization(auth.uid()))) OR
  ((get_user_role(auth.uid()) = 'hod') AND (department_id = get_user_department(auth.uid())))
);