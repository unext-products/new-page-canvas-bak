-- Create organization_labels table for custom labels per organization
CREATE TABLE public.organization_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Role labels
  role_org_admin text DEFAULT 'Organization Admin' NOT NULL,
  role_program_manager text DEFAULT 'Program Manager' NOT NULL,
  role_manager text DEFAULT 'Manager' NOT NULL,
  role_member text DEFAULT 'Member' NOT NULL,
  
  -- Entity labels (singular and plural)
  entity_department text DEFAULT 'Department' NOT NULL,
  entity_department_plural text DEFAULT 'Departments' NOT NULL,
  entity_program text DEFAULT 'Program' NOT NULL,
  entity_program_plural text DEFAULT 'Programs' NOT NULL,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.organization_labels ENABLE ROW LEVEL SECURITY;

-- Users can view their organization's labels
CREATE POLICY "Users can view their organization labels"
ON public.organization_labels FOR SELECT TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

-- Org admins can update their organization labels
CREATE POLICY "Org admins can update their organization labels"
ON public.organization_labels FOR UPDATE TO authenticated
USING (
  (get_user_role(auth.uid()) = 'org_admin') AND 
  (organization_id = get_user_organization(auth.uid()))
);

-- Org admins can insert their organization labels (for initialization)
CREATE POLICY "Org admins can insert their organization labels"
ON public.organization_labels FOR INSERT TO authenticated
WITH CHECK (
  (get_user_role(auth.uid()) = 'org_admin') AND 
  (organization_id = get_user_organization(auth.uid()))
);

-- Add updated_at trigger
CREATE TRIGGER update_organization_labels_updated_at
  BEFORE UPDATE ON public.organization_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Initialize labels for all existing organizations
INSERT INTO public.organization_labels (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

-- Update handle_new_user to also create default labels for new organizations
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
  
  -- Assign org_admin role to the new user
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (NEW.id, 'org_admin', v_organization_id);
  
  RETURN NEW;
END;
$function$;