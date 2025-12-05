-- Create department_settings table for department-specific overrides
CREATE TABLE public.department_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL UNIQUE,
  daily_target_minutes integer,
  submission_window_days integer,
  time_format text CHECK (time_format IN ('12h', '24h')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.department_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for department_settings
CREATE POLICY "HODs can view their department settings"
ON public.department_settings FOR SELECT
USING (
  department_id = get_user_department(auth.uid())
  OR (get_user_role(auth.uid()) = 'org_admin' AND department_id IN (
    SELECT id FROM departments WHERE organization_id = get_user_organization(auth.uid())
  ))
);

CREATE POLICY "HODs can insert their department settings"
ON public.department_settings FOR INSERT
WITH CHECK (
  (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid()))
  OR (get_user_role(auth.uid()) = 'org_admin' AND department_id IN (
    SELECT id FROM departments WHERE organization_id = get_user_organization(auth.uid())
  ))
);

CREATE POLICY "HODs can update their department settings"
ON public.department_settings FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid()))
  OR (get_user_role(auth.uid()) = 'org_admin' AND department_id IN (
    SELECT id FROM departments WHERE organization_id = get_user_organization(auth.uid())
  ))
);

CREATE POLICY "HODs can delete their department settings"
ON public.department_settings FOR DELETE
USING (
  (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid()))
  OR (get_user_role(auth.uid()) = 'org_admin' AND department_id IN (
    SELECT id FROM departments WHERE organization_id = get_user_organization(auth.uid())
  ))
);

-- Create activity_categories table
CREATE TABLE public.activity_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(organization_id, department_id, code)
);

-- Enable RLS
ALTER TABLE public.activity_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_categories
CREATE POLICY "Users can view categories in their organization"
ON public.activity_categories FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "HODs can insert department categories"
ON public.activity_categories FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND (
    (get_user_role(auth.uid()) = 'org_admin')
    OR (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid()))
  )
);

CREATE POLICY "HODs can update department categories"
ON public.activity_categories FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    (get_user_role(auth.uid()) = 'org_admin')
    OR (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid()))
  )
);

CREATE POLICY "HODs can delete department categories"
ON public.activity_categories FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  AND (
    (get_user_role(auth.uid()) = 'org_admin')
    OR (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid()))
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_department_settings_updated_at
BEFORE UPDATE ON public.department_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_activity_categories_updated_at
BEFORE UPDATE ON public.activity_categories
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default categories for all existing organizations
INSERT INTO public.activity_categories (organization_id, department_id, name, code, description, display_order)
SELECT 
  o.id,
  NULL,
  unnest(ARRAY['Class', 'Quiz', 'Invigilation', 'Admin', 'Other']),
  unnest(ARRAY['class', 'quiz', 'invigilation', 'admin', 'other']),
  unnest(ARRAY['Teaching/lecture sessions', 'Quizzes and assessments', 'Exam invigilation/proctoring', 'Administrative tasks', 'Miscellaneous activities']),
  unnest(ARRAY[1, 2, 3, 4, 5])
FROM public.organizations o;