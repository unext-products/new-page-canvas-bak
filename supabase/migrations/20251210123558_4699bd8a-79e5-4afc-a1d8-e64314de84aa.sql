-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('org_admin', 'program_manager', 'hod', 'faculty');

-- Create other enums
CREATE TYPE public.activity_type AS ENUM ('class', 'quiz', 'invigilation', 'admin', 'other');
CREATE TYPE public.entry_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.leave_type AS ENUM ('casual', 'sick', 'earned', 'half_day', 'comp_off', 'other');

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Create programs table
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(department_id, code)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_departments junction table for many-to-many
CREATE TABLE public.user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);

-- Create user_programs junction table for many-to-many
CREATE TABLE public.user_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);

-- Create timesheet_entries table
CREATE TABLE public.timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  activity_type public.activity_type NOT NULL,
  activity_subtype TEXT,
  notes TEXT,
  status public.entry_status NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approver_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leave_days table
CREATE TABLE public.leave_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  leave_type public.leave_type NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_date)
);

-- Create activity_categories table
CREATE TABLE public.activity_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_labels table
CREATE TABLE public.organization_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_org_admin TEXT NOT NULL DEFAULT 'Admin',
  role_program_manager TEXT NOT NULL DEFAULT 'Program Manager',
  role_manager TEXT NOT NULL DEFAULT 'HOD',
  role_member TEXT NOT NULL DEFAULT 'Faculty',
  entity_department TEXT NOT NULL DEFAULT 'Department',
  entity_department_plural TEXT NOT NULL DEFAULT 'Departments',
  entity_program TEXT NOT NULL DEFAULT 'Program',
  entity_program_plural TEXT NOT NULL DEFAULT 'Programs',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_user_departments_user_id ON public.user_departments(user_id);
CREATE INDEX idx_user_departments_department_id ON public.user_departments(department_id);
CREATE INDEX idx_user_programs_user_id ON public.user_programs(user_id);
CREATE INDEX idx_user_programs_program_id ON public.user_programs(program_id);
CREATE INDEX idx_timesheet_entries_user_id ON public.timesheet_entries(user_id);
CREATE INDEX idx_timesheet_entries_entry_date ON public.timesheet_entries(entry_date);
CREATE INDEX idx_timesheet_entries_status ON public.timesheet_entries(status);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_labels ENABLE ROW LEVEL SECURITY;

-- Create helper functions
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_roles.user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_department(user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.user_roles WHERE user_roles.user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization(user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_roles WHERE user_roles.user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_program(user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT program_id FROM public.user_roles WHERE user_roles.user_id = $1;
$$;

-- Profile trigger for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Org admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.get_user_role(auth.uid()) = 'org_admin');

CREATE POLICY "Org admins can manage user roles" ON public.user_roles
  FOR ALL USING (public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for user_departments
CREATE POLICY "Users can view department assignments" ON public.user_departments
  FOR SELECT USING (user_id = auth.uid() OR public.get_user_role(auth.uid()) = 'org_admin');

CREATE POLICY "Org admins can manage department assignments" ON public.user_departments
  FOR ALL USING (public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for user_programs
CREATE POLICY "Users can view program assignments" ON public.user_programs
  FOR SELECT USING (user_id = auth.uid() OR public.get_user_role(auth.uid()) = 'org_admin');

CREATE POLICY "Org admins can manage program assignments" ON public.user_programs
  FOR ALL USING (public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization" ON public.organizations
  FOR SELECT USING (id = public.get_user_organization(auth.uid()));

CREATE POLICY "Org admins can manage their organization" ON public.organizations
  FOR ALL USING (id = public.get_user_organization(auth.uid()) AND public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for departments
CREATE POLICY "Users can view departments in their org" ON public.departments
  FOR SELECT USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Org admins can manage departments" ON public.departments
  FOR ALL USING (organization_id = public.get_user_organization(auth.uid()) AND public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for programs
CREATE POLICY "Users can view programs" ON public.programs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.departments d WHERE d.id = programs.department_id AND d.organization_id = public.get_user_organization(auth.uid())));

CREATE POLICY "Org admins can manage programs" ON public.programs
  FOR ALL USING (EXISTS (SELECT 1 FROM public.departments d WHERE d.id = programs.department_id AND d.organization_id = public.get_user_organization(auth.uid())) AND public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for timesheet_entries
CREATE POLICY "Users can view their own entries" ON public.timesheet_entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own entries" ON public.timesheet_entries
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "HODs can view department entries" ON public.timesheet_entries
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'hod' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = timesheet_entries.user_id AND ur.department_id = public.get_user_department(auth.uid())));

CREATE POLICY "Org admins can view all entries" ON public.timesheet_entries
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for leave_days
CREATE POLICY "Users can view their own leaves" ON public.leave_days
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own leaves" ON public.leave_days
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "HODs can view department leaves" ON public.leave_days
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'hod' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = leave_days.user_id AND ur.department_id = public.get_user_department(auth.uid())));

-- RLS Policies for activity_categories
CREATE POLICY "Users can view categories" ON public.activity_categories
  FOR SELECT USING (organization_id = public.get_user_organization(auth.uid()) OR organization_id IS NULL);

CREATE POLICY "Org admins can manage categories" ON public.activity_categories
  FOR ALL USING (public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for settings
CREATE POLICY "Users can view settings" ON public.settings
  FOR SELECT USING (true);

CREATE POLICY "Org admins can manage settings" ON public.settings
  FOR ALL USING (public.get_user_role(auth.uid()) = 'org_admin');

-- RLS Policies for organization_labels
CREATE POLICY "Users can view labels" ON public.organization_labels
  FOR SELECT USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Org admins can manage labels" ON public.organization_labels
  FOR ALL USING (organization_id = public.get_user_organization(auth.uid()) AND public.get_user_role(auth.uid()) = 'org_admin');