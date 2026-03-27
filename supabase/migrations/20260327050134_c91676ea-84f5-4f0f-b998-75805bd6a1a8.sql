
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;
