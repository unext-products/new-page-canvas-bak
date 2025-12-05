-- Drop the existing overly permissive SELECT policy on departments
DROP POLICY IF EXISTS "Anyone authenticated can view departments" ON public.departments;

-- Create a new policy that scopes department visibility to user's organization
CREATE POLICY "Users can view departments in their organization"
ON public.departments
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));