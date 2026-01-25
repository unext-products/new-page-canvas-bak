-- Add RLS policies on user_programs for L2 and L3 to view program assignments

-- Allow L2 to view user_programs for users in programs they're assigned to
CREATE POLICY "L2 can view program assignments in their programs"
ON public.user_programs FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l2'::app_role
  AND program_id = ANY(get_user_programs(auth.uid()))
);

-- Allow L3 to view user_programs for users in their verticals (via programs linked to those verticals)
CREATE POLICY "L3 can view program assignments in their verticals"
ON public.user_programs FOR SELECT
USING (
  get_user_role(auth.uid()) = 'l3'::app_role
  AND EXISTS (
    SELECT 1 FROM public.programs p
    WHERE p.id = user_programs.program_id
    AND p.vertical_id = ANY(get_user_verticals(auth.uid()))
  )
);