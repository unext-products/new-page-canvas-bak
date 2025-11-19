-- Migration 2: Create organizations and programs tables with relationships

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create programs table (belongs to organization)
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add organization_id and program_id to departments (departments belong to programs)
ALTER TABLE public.departments
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

-- Add organization_id and program_id to user_roles for hierarchical access control
ALTER TABLE public.user_roles
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- RLS policies for organizations
CREATE POLICY "Anyone authenticated can view organizations"
  ON public.organizations
  FOR SELECT
  USING (true);

CREATE POLICY "Only org admins can insert organizations"
  ON public.organizations
  FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = 'org_admin');

CREATE POLICY "Only org admins can update organizations"
  ON public.organizations
  FOR UPDATE
  USING (get_user_role(auth.uid()) = 'org_admin');

CREATE POLICY "Only org admins can delete organizations"
  ON public.organizations
  FOR DELETE
  USING (get_user_role(auth.uid()) = 'org_admin');

-- RLS policies for programs
CREATE POLICY "Anyone authenticated can view programs"
  ON public.programs
  FOR SELECT
  USING (true);

CREATE POLICY "Org admins and program managers can insert programs"
  ON public.programs
  FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) IN ('org_admin', 'program_manager', 'admin')
  );

CREATE POLICY "Org admins and program managers can update programs"
  ON public.programs
  FOR UPDATE
  USING (
    get_user_role(auth.uid()) IN ('org_admin', 'program_manager', 'admin')
  );

CREATE POLICY "Org admins and program managers can delete programs"
  ON public.programs
  FOR DELETE
  USING (
    get_user_role(auth.uid()) IN ('org_admin', 'program_manager', 'admin')
  );

-- Add updated_at triggers for new tables
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();