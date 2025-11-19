-- Update the handle_new_user trigger to create organization and assign org_admin role
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Assign org_admin role to the new user
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (NEW.id, 'org_admin', v_organization_id);
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();