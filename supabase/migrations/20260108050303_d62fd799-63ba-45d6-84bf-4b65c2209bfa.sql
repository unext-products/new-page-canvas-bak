-- Create user_settings table for per-user, per-department settings
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, department_id, key)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own settings"
  ON public.user_settings FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Org admins can manage all user settings"
  ON public.user_settings FOR ALL
  USING (get_user_role(auth.uid()) = 'org_admin'::app_role);

CREATE POLICY "HODs can manage user settings in their departments"
  ON public.user_settings FOR ALL
  USING (
    get_user_role(auth.uid()) = 'hod'::app_role 
    AND department_id = ANY(get_user_departments(auth.uid()))
  );