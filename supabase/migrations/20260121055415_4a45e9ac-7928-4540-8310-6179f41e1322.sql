-- Add parent_id and sort_order columns to activity_categories for 2-level hierarchy
ALTER TABLE public.activity_categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.activity_categories(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for performance on parent_id lookups
CREATE INDEX IF NOT EXISTS idx_activity_categories_parent_id ON public.activity_categories(parent_id);

-- Create index for sort_order
CREATE INDEX IF NOT EXISTS idx_activity_categories_sort_order ON public.activity_categories(sort_order);