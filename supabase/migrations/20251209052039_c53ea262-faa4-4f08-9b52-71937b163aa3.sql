-- Create organization_approval_settings table
CREATE TABLE public.organization_approval_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Which roles need approval before their entries are final
  member_requires_approval boolean NOT NULL DEFAULT true,
  program_manager_requires_approval boolean NOT NULL DEFAULT true,
  manager_requires_approval boolean NOT NULL DEFAULT true,
  
  -- Who approves each role: 'manager' | 'org_admin' | null (auto-approved)
  member_approved_by text DEFAULT 'manager',
  program_manager_approved_by text DEFAULT 'manager',
  manager_approved_by text DEFAULT 'org_admin',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.organization_approval_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view their organization's settings
CREATE POLICY "Users can view their org approval settings"
ON public.organization_approval_settings
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

-- Only org admins can insert
CREATE POLICY "Org admins can insert approval settings"
ON public.organization_approval_settings
FOR INSERT
WITH CHECK (
  get_user_role(auth.uid()) = 'org_admin' AND
  organization_id = get_user_organization(auth.uid())
);

-- Only org admins can update
CREATE POLICY "Org admins can update approval settings"
ON public.organization_approval_settings
FOR UPDATE
USING (
  get_user_role(auth.uid()) = 'org_admin' AND
  organization_id = get_user_organization(auth.uid())
);

-- Only org admins can delete
CREATE POLICY "Org admins can delete approval settings"
ON public.organization_approval_settings
FOR DELETE
USING (
  get_user_role(auth.uid()) = 'org_admin' AND
  organization_id = get_user_organization(auth.uid())
);

-- Add updated_at trigger
CREATE TRIGGER update_organization_approval_settings_updated_at
BEFORE UPDATE ON public.organization_approval_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update handle_new_user to create default approval settings for new organizations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id uuid;
  v_organization_name text;
  v_organization_code text;
BEGIN
  -- Extract organization details from metadata
  v_organization_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', 'My Organization');
  v_organization_code := COALESCE(NEW.raw_user_meta_data->>'organization_code', 'ORG');
  
  -- Create the profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Create the organization
  INSERT INTO public.organizations (name, code)
  VALUES (v_organization_name, v_organization_code)
  RETURNING id INTO v_organization_id;
  
  -- Create default labels for the organization
  INSERT INTO public.organization_labels (organization_id)
  VALUES (v_organization_id);
  
  -- Create default approval settings for the organization
  INSERT INTO public.organization_approval_settings (organization_id)
  VALUES (v_organization_id);
  
  -- Assign org_admin role to the new user
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (NEW.id, 'org_admin', v_organization_id);
  
  RETURN NEW;
END;
$function$;