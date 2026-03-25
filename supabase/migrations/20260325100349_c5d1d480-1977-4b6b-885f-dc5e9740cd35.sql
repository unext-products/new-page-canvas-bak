
-- Create reporting_hierarchy table
CREATE TABLE public.reporting_hierarchy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, manager_id)
);

-- Enable RLS
ALTER TABLE public.reporting_hierarchy ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Org admins can manage reporting hierarchy"
  ON public.reporting_hierarchy FOR ALL
  USING (get_user_role(auth.uid()) = 'org_admin'::app_role);

CREATE POLICY "Super admins can manage all reporting hierarchy"
  ON public.reporting_hierarchy FOR ALL
  USING (is_super_admin(auth.uid()));

-- Managers can view their own reportees
CREATE POLICY "Managers can view their reportees"
  ON public.reporting_hierarchy FOR SELECT
  USING (manager_id = auth.uid());

-- Users can view their own reporting relationship
CREATE POLICY "Users can view own reporting"
  ON public.reporting_hierarchy FOR SELECT
  USING (user_id = auth.uid());

-- Helper function: get direct reportees for a manager
CREATE OR REPLACE FUNCTION public.get_direct_reportees(p_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[])
  FROM public.reporting_hierarchy
  WHERE manager_id = p_manager_id;
$$;

-- Helper function: get transitive reportees (L1s under an L3 via their L2 reportees)
CREATE OR REPLACE FUNCTION public.get_transitive_reportees(p_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT r2.user_id), ARRAY[]::uuid[])
  FROM public.reporting_hierarchy r1
  JOIN public.reporting_hierarchy r2 ON r2.manager_id = r1.user_id
  WHERE r1.manager_id = p_manager_id;
$$;

-- Helper function: get all reportees (direct + transitive)
CREATE OR REPLACE FUNCTION public.get_all_reportees(p_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT uid), ARRAY[]::uuid[])
  FROM (
    -- Direct reportees
    SELECT user_id AS uid FROM public.reporting_hierarchy WHERE manager_id = p_manager_id
    UNION
    -- Transitive reportees (L1s under L2s who report to this manager)
    SELECT r2.user_id AS uid
    FROM public.reporting_hierarchy r1
    JOIN public.reporting_hierarchy r2 ON r2.manager_id = r1.user_id
    WHERE r1.manager_id = p_manager_id
  ) sub;
$$;

-- Helper function: check if manager has any reportees configured
CREATE OR REPLACE FUNCTION public.has_reporting_hierarchy(p_manager_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reporting_hierarchy WHERE manager_id = p_manager_id
  );
$$;
