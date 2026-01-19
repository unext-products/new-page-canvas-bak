-- Create timesheet_thresholds table for max hours and work hour window settings
CREATE TABLE public.timesheet_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vertical_id uuid REFERENCES public.verticals(id) ON DELETE CASCADE,
  
  -- Max Hours Threshold
  max_hours_enabled boolean DEFAULT false NOT NULL,
  max_hours_minutes integer DEFAULT 480,
  
  -- Work Hour Threshold
  work_hours_enabled boolean DEFAULT false NOT NULL,
  work_start_time time DEFAULT '08:30:00',
  work_end_time time DEFAULT '17:30:00',
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Unique constraint: org-wide (vertical_id IS NULL) or vertical-specific
  UNIQUE (organization_id, vertical_id)
);

-- Create working_days table for configuring which days are working days
CREATE TABLE public.working_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vertical_id uuid REFERENCES public.verticals(id) ON DELETE CASCADE,
  
  -- Boolean for each day (true = working day)
  monday boolean DEFAULT true NOT NULL,
  tuesday boolean DEFAULT true NOT NULL,
  wednesday boolean DEFAULT true NOT NULL,
  thursday boolean DEFAULT true NOT NULL,
  friday boolean DEFAULT true NOT NULL,
  saturday boolean DEFAULT false NOT NULL,
  sunday boolean DEFAULT false NOT NULL,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE (organization_id, vertical_id)
);

-- Create holidays table for organization/vertical holidays
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vertical_id uuid REFERENCES public.verticals(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  holiday_date date NOT NULL,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE (organization_id, vertical_id, holiday_date)
);

-- Enable RLS on all tables
ALTER TABLE public.timesheet_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- RLS Policies for timesheet_thresholds
CREATE POLICY "Super admins can manage all thresholds" 
ON public.timesheet_thresholds FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their org thresholds" 
ON public.timesheet_thresholds FOR ALL 
USING (
  (organization_id = get_user_organization(auth.uid())) 
  AND (get_user_role(auth.uid()) = 'org_admin'::app_role)
);

CREATE POLICY "Users can view their org thresholds" 
ON public.timesheet_thresholds FOR SELECT 
USING (organization_id = get_user_organization(auth.uid()));

-- RLS Policies for working_days
CREATE POLICY "Super admins can manage all working days" 
ON public.working_days FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their org working days" 
ON public.working_days FOR ALL 
USING (
  (organization_id = get_user_organization(auth.uid())) 
  AND (get_user_role(auth.uid()) = 'org_admin'::app_role)
);

CREATE POLICY "Users can view their org working days" 
ON public.working_days FOR SELECT 
USING (organization_id = get_user_organization(auth.uid()));

-- RLS Policies for holidays
CREATE POLICY "Super admins can manage all holidays" 
ON public.holidays FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org admins can manage their org holidays" 
ON public.holidays FOR ALL 
USING (
  (organization_id = get_user_organization(auth.uid())) 
  AND (get_user_role(auth.uid()) = 'org_admin'::app_role)
);

CREATE POLICY "Users can view their org holidays" 
ON public.holidays FOR SELECT 
USING (organization_id = get_user_organization(auth.uid()));