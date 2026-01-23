-- Drop ALL the L2 policies I created that are causing infinite recursion
-- These are the exact policy names from my previous migration

DROP POLICY IF EXISTS "L2 can view vertical assignments in their verticals" ON public.user_verticals;
DROP POLICY IF EXISTS "L2 can view user roles in their verticals" ON public.user_roles;
DROP POLICY IF EXISTS "L2 can view profiles in their verticals" ON public.profiles;
DROP POLICY IF EXISTS "L2 can view leave days in their verticals" ON public.leave_days;
DROP POLICY IF EXISTS "L2 can view timesheet entries in their verticals" ON public.timesheet_entries;