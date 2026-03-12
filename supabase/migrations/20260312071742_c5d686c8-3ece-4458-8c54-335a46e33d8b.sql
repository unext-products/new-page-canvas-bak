
-- Add deactivated_at column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL;

-- Create trigger function to auto-set deactivated_at when is_active changes
CREATE OR REPLACE FUNCTION public.handle_profile_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When is_active changes from true to false, set deactivated_at
  IF OLD.is_active = true AND NEW.is_active = false THEN
    NEW.deactivated_at = now();
  END IF;
  -- When is_active changes from false to true, clear deactivated_at
  IF OLD.is_active = false AND NEW.is_active = true THEN
    NEW.deactivated_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger on profiles
CREATE TRIGGER on_profile_deactivation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_deactivation();

-- Backfill: set deactivated_at for currently inactive users to their updated_at timestamp
UPDATE public.profiles SET deactivated_at = updated_at WHERE is_active = false AND deactivated_at IS NULL;
