-- Add department_code column to timesheet_entries table
ALTER TABLE public.timesheet_entries 
ADD COLUMN IF NOT EXISTS department_code text NULL;