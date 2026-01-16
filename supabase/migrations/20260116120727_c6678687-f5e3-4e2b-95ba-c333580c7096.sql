-- Create organization_approval_settings table for storing approval workflow configuration
CREATE TABLE public.organization_approval_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  l1_requires_approval boolean DEFAULT true NOT NULL,
  l2_requires_approval boolean DEFAULT true NOT NULL,
  l3_requires_approval boolean DEFAULT true NOT NULL,
  l1_approved_by text[] DEFAULT ARRAY['l2']::text[] NOT NULL,
  l2_approved_by text[] DEFAULT ARRAY['l3']::text[] NOT NULL,
  l3_approved_by text[] DEFAULT ARRAY['org_admin']::text[] NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE public.organization_approval_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Org admins can manage their org's approval settings
CREATE POLICY "Org admins can manage approval settings"
  ON public.organization_approval_settings
  FOR ALL
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.get_user_role(auth.uid()) = 'org_admin'::app_role
  )
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND public.get_user_role(auth.uid()) = 'org_admin'::app_role
  );

-- Policy: Super admins can manage all approval settings
CREATE POLICY "Super admins can manage all approval settings"
  ON public.organization_approval_settings
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Policy: All org users can read their org's approval settings (needed for approval flow)
CREATE POLICY "Org users can read approval settings"
  ON public.organization_approval_settings
  FOR SELECT
  USING (
    organization_id = public.get_user_organization(auth.uid())
  );