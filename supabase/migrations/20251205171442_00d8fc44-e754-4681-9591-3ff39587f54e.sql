-- Create user_settings table for user-specific overrides
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_target_minutes integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings
CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
USING (user_id = auth.uid());

-- HODs can view settings for users in their department
CREATE POLICY "HODs can view department user settings"
ON public.user_settings
FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role) 
  AND (get_user_department(user_id) = get_user_department(auth.uid()))
);

-- Org admins can view all user settings in their organization
CREATE POLICY "Org admins can view all user settings"
ON public.user_settings
FOR SELECT
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role)
  AND is_same_organization(user_id)
);

-- HODs can insert settings for users in their department
CREATE POLICY "HODs can insert department user settings"
ON public.user_settings
FOR INSERT
WITH CHECK (
  (get_user_role(auth.uid()) = 'hod'::app_role)
  AND (get_user_department(user_id) = get_user_department(auth.uid()))
);

-- Org admins can insert settings for any user in their organization
CREATE POLICY "Org admins can insert user settings"
ON public.user_settings
FOR INSERT
WITH CHECK (
  (get_user_role(auth.uid()) = 'org_admin'::app_role)
  AND is_same_organization(user_id)
);

-- HODs can update settings for users in their department
CREATE POLICY "HODs can update department user settings"
ON public.user_settings
FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role)
  AND (get_user_department(user_id) = get_user_department(auth.uid()))
);

-- Org admins can update settings for any user in their organization
CREATE POLICY "Org admins can update user settings"
ON public.user_settings
FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role)
  AND is_same_organization(user_id)
);

-- HODs can delete settings for users in their department
CREATE POLICY "HODs can delete department user settings"
ON public.user_settings
FOR DELETE
USING (
  (get_user_role(auth.uid()) = 'hod'::app_role)
  AND (get_user_department(user_id) = get_user_department(auth.uid()))
);

-- Org admins can delete settings for any user in their organization
CREATE POLICY "Org admins can delete user settings"
ON public.user_settings
FOR DELETE
USING (
  (get_user_role(auth.uid()) = 'org_admin'::app_role)
  AND is_same_organization(user_id)
);

-- Add updated_at trigger
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();