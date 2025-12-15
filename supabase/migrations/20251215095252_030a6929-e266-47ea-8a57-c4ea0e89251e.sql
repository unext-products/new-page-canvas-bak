-- Fix: newly created HODs may have department_id set in user_roles but no row in user_departments.
-- Team/Dashboard/Reports use user_departments to scope HOD visibility.

INSERT INTO public.user_departments (user_id, department_id)
SELECT ur.user_id, ur.department_id
FROM public.user_roles ur
WHERE ur.role = 'hod'
  AND ur.department_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_departments ud
    WHERE ud.user_id = ur.user_id
      AND ud.department_id = ur.department_id
  );

-- Optional: also ensure faculty have at least one department link (keeps system consistent).
INSERT INTO public.user_departments (user_id, department_id)
SELECT ur.user_id, ur.department_id
FROM public.user_roles ur
WHERE ur.role = 'faculty'
  AND ur.department_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_departments ud
    WHERE ud.user_id = ur.user_id
      AND ud.department_id = ur.department_id
  );