
-- =====================================================
-- PHASE 1: CREATE NEW HIERARCHY TABLES
-- =====================================================

-- 1.1 Create verticals table (conceptual replacement for departments)
CREATE TABLE public.verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- 1.2 Create batches table (belongs to programs)
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.3 Create terms table (belongs to batches)
CREATE TABLE public.terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.4 Create subjects table (belongs to terms)
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PHASE 2: CREATE USER JUNCTION TABLES
-- =====================================================

-- 2.1 Create user_verticals junction table
CREATE TABLE public.user_verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  vertical_id UUID NOT NULL REFERENCES public.verticals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, vertical_id)
);

-- 2.2 Create user_batches junction table
CREATE TABLE public.user_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, batch_id)
);

-- 2.3 Create user_subjects junction table
CREATE TABLE public.user_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject_id)
);

-- =====================================================
-- PHASE 3: UPDATE EXISTING TABLES
-- =====================================================

-- 3.1 Add vertical_id to programs table (programs now belong to verticals)
ALTER TABLE public.programs ADD COLUMN vertical_id UUID REFERENCES public.verticals(id) ON DELETE CASCADE;

-- 3.2 Add vertical_id to user_roles for backward compatibility
ALTER TABLE public.user_roles ADD COLUMN vertical_id UUID REFERENCES public.verticals(id);

-- 3.3 Add hierarchy columns to timesheet_entries
ALTER TABLE public.timesheet_entries 
  ADD COLUMN vertical_id UUID REFERENCES public.verticals(id),
  ADD COLUMN vertical_code TEXT,
  ADD COLUMN program_id UUID REFERENCES public.programs(id),
  ADD COLUMN batch_id UUID REFERENCES public.batches(id),
  ADD COLUMN batch_name TEXT,
  ADD COLUMN term_id UUID REFERENCES public.terms(id),
  ADD COLUMN term_name TEXT,
  ADD COLUMN subject_id UUID REFERENCES public.subjects(id),
  ADD COLUMN subject_code TEXT;

-- 3.4 Add vertical_id to user_settings
ALTER TABLE public.user_settings ADD COLUMN vertical_id UUID REFERENCES public.verticals(id);

-- 3.5 Add vertical_id to settings (org-level settings)
ALTER TABLE public.settings ADD COLUMN vertical_id UUID REFERENCES public.verticals(id);

-- =====================================================
-- PHASE 4: MIGRATE DATA FROM DEPARTMENTS TO VERTICALS
-- =====================================================

-- 4.1 Copy departments to verticals (preserving IDs for easy reference)
INSERT INTO public.verticals (id, organization_id, name, code, created_at, updated_at)
SELECT id, organization_id, name, code, created_at, updated_at
FROM public.departments;

-- 4.2 Copy user_departments to user_verticals
INSERT INTO public.user_verticals (user_id, vertical_id, created_at)
SELECT user_id, department_id, created_at
FROM public.user_departments
ON CONFLICT (user_id, vertical_id) DO NOTHING;

-- 4.3 Update programs to reference verticals (using existing department_id)
UPDATE public.programs 
SET vertical_id = department_id 
WHERE department_id IS NOT NULL;

-- 4.4 Update user_roles to have vertical_id (from existing department_id)
UPDATE public.user_roles 
SET vertical_id = department_id 
WHERE department_id IS NOT NULL;

-- 4.5 Migrate existing timesheet_entries department info to vertical columns
UPDATE public.timesheet_entries 
SET vertical_code = department_code 
WHERE department_code IS NOT NULL;

-- =====================================================
-- PHASE 5: CREATE HELPER FUNCTIONS
-- =====================================================

-- 5.1 Get user's verticals as array
CREATE OR REPLACE FUNCTION public.get_user_verticals(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(vertical_id),
    ARRAY[]::uuid[]
  )
  FROM public.user_verticals
  WHERE user_id = p_user_id;
$$;

-- 5.2 Check if user belongs to a vertical
CREATE OR REPLACE FUNCTION public.user_in_vertical(p_user_id UUID, p_vertical_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_verticals
    WHERE user_id = p_user_id AND vertical_id = p_vertical_id
  );
$$;

-- 5.3 Get user's single vertical from user_roles (backward compat)
CREATE OR REPLACE FUNCTION public.get_user_vertical(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vertical_id FROM public.user_roles WHERE user_roles.user_id = $1;
$$;

-- 5.4 Get user's batches as array
CREATE OR REPLACE FUNCTION public.get_user_batches(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(batch_id),
    ARRAY[]::uuid[]
  )
  FROM public.user_batches
  WHERE user_id = p_user_id;
$$;

-- 5.5 Check if user belongs to a batch
CREATE OR REPLACE FUNCTION public.user_in_batch(p_user_id UUID, p_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_batches
    WHERE user_id = p_user_id AND batch_id = p_batch_id
  );
$$;

-- 5.6 Get user's subjects as array
CREATE OR REPLACE FUNCTION public.get_user_subjects(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(subject_id),
    ARRAY[]::uuid[]
  )
  FROM public.user_subjects
  WHERE user_id = p_user_id;
$$;

-- 5.7 Check if user belongs to a subject
CREATE OR REPLACE FUNCTION public.user_in_subject(p_user_id UUID, p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subjects
    WHERE user_id = p_user_id AND subject_id = p_subject_id
  );
$$;

-- =====================================================
-- PHASE 6: ENABLE RLS AND CREATE POLICIES
-- =====================================================

-- 6.1 Verticals table RLS
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view verticals in their org"
ON public.verticals FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Org admins can manage verticals"
ON public.verticals FOR ALL
USING (
  organization_id = get_user_organization(auth.uid()) 
  AND get_user_role(auth.uid()) = 'org_admin'::app_role
);

-- 6.2 Batches table RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view batches in their org"
ON public.batches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.programs p
    JOIN public.verticals v ON v.id = p.vertical_id
    WHERE p.id = batches.program_id
    AND v.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Org admins can manage batches"
ON public.batches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.programs p
    JOIN public.verticals v ON v.id = p.vertical_id
    WHERE p.id = batches.program_id
    AND v.organization_id = get_user_organization(auth.uid())
  )
  AND get_user_role(auth.uid()) = 'org_admin'::app_role
);

-- 6.3 Terms table RLS
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view terms in their org"
ON public.terms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.batches b
    JOIN public.programs p ON p.id = b.program_id
    JOIN public.verticals v ON v.id = p.vertical_id
    WHERE b.id = terms.batch_id
    AND v.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Org admins can manage terms"
ON public.terms FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.batches b
    JOIN public.programs p ON p.id = b.program_id
    JOIN public.verticals v ON v.id = p.vertical_id
    WHERE b.id = terms.batch_id
    AND v.organization_id = get_user_organization(auth.uid())
  )
  AND get_user_role(auth.uid()) = 'org_admin'::app_role
);

-- 6.4 Subjects table RLS
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subjects in their org"
ON public.subjects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.terms t
    JOIN public.batches b ON b.id = t.batch_id
    JOIN public.programs p ON p.id = b.program_id
    JOIN public.verticals v ON v.id = p.vertical_id
    WHERE t.id = subjects.term_id
    AND v.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Org admins can manage subjects"
ON public.subjects FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.terms t
    JOIN public.batches b ON b.id = t.batch_id
    JOIN public.programs p ON p.id = b.program_id
    JOIN public.verticals v ON v.id = p.vertical_id
    WHERE t.id = subjects.term_id
    AND v.organization_id = get_user_organization(auth.uid())
  )
  AND get_user_role(auth.uid()) = 'org_admin'::app_role
);

-- 6.5 User Verticals junction table RLS
ALTER TABLE public.user_verticals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vertical assignments"
ON public.user_verticals FOR SELECT
USING (
  user_id = auth.uid() 
  OR get_user_role(auth.uid()) = 'org_admin'::app_role
);

CREATE POLICY "Org admins can manage vertical assignments"
ON public.user_verticals FOR ALL
USING (get_user_role(auth.uid()) = 'org_admin'::app_role);

CREATE POLICY "HODs can view vertical assignments in their verticals"
ON public.user_verticals FOR SELECT
USING (
  get_user_role(auth.uid()) = 'hod'::app_role 
  AND vertical_id = ANY(get_user_verticals(auth.uid()))
);

-- 6.6 User Batches junction table RLS
ALTER TABLE public.user_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view batch assignments"
ON public.user_batches FOR SELECT
USING (
  user_id = auth.uid() 
  OR get_user_role(auth.uid()) = 'org_admin'::app_role
);

CREATE POLICY "Org admins can manage batch assignments"
ON public.user_batches FOR ALL
USING (get_user_role(auth.uid()) = 'org_admin'::app_role);

-- 6.7 User Subjects junction table RLS
ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subject assignments"
ON public.user_subjects FOR SELECT
USING (
  user_id = auth.uid() 
  OR get_user_role(auth.uid()) = 'org_admin'::app_role
);

CREATE POLICY "Org admins can manage subject assignments"
ON public.user_subjects FOR ALL
USING (get_user_role(auth.uid()) = 'org_admin'::app_role);

-- =====================================================
-- PHASE 7: UPDATE ORGANIZATION_LABELS FOR NEW ENTITIES
-- =====================================================

ALTER TABLE public.organization_labels
  ADD COLUMN entity_vertical TEXT NOT NULL DEFAULT 'Vertical',
  ADD COLUMN entity_vertical_plural TEXT NOT NULL DEFAULT 'Verticals',
  ADD COLUMN entity_batch TEXT NOT NULL DEFAULT 'Batch',
  ADD COLUMN entity_batch_plural TEXT NOT NULL DEFAULT 'Batches',
  ADD COLUMN entity_term TEXT NOT NULL DEFAULT 'Term',
  ADD COLUMN entity_term_plural TEXT NOT NULL DEFAULT 'Terms',
  ADD COLUMN entity_subject TEXT NOT NULL DEFAULT 'Subject',
  ADD COLUMN entity_subject_plural TEXT NOT NULL DEFAULT 'Subjects';

-- Copy department labels to vertical labels for existing orgs
UPDATE public.organization_labels
SET 
  entity_vertical = entity_department,
  entity_vertical_plural = entity_department_plural;

-- =====================================================
-- PHASE 8: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_verticals_organization ON public.verticals(organization_id);
CREATE INDEX idx_batches_program ON public.batches(program_id);
CREATE INDEX idx_terms_batch ON public.terms(batch_id);
CREATE INDEX idx_subjects_term ON public.subjects(term_id);
CREATE INDEX idx_programs_vertical ON public.programs(vertical_id);

CREATE INDEX idx_user_verticals_user ON public.user_verticals(user_id);
CREATE INDEX idx_user_verticals_vertical ON public.user_verticals(vertical_id);
CREATE INDEX idx_user_batches_user ON public.user_batches(user_id);
CREATE INDEX idx_user_batches_batch ON public.user_batches(batch_id);
CREATE INDEX idx_user_subjects_user ON public.user_subjects(user_id);
CREATE INDEX idx_user_subjects_subject ON public.user_subjects(subject_id);

CREATE INDEX idx_timesheet_vertical ON public.timesheet_entries(vertical_id);
CREATE INDEX idx_timesheet_program ON public.timesheet_entries(program_id);
CREATE INDEX idx_timesheet_batch ON public.timesheet_entries(batch_id);
CREATE INDEX idx_timesheet_term ON public.timesheet_entries(term_id);
CREATE INDEX idx_timesheet_subject ON public.timesheet_entries(subject_id);
