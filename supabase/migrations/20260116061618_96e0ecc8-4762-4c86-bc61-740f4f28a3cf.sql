-- Make department_id nullable since we've migrated to verticals as the primary relationship
ALTER TABLE programs 
ALTER COLUMN department_id DROP NOT NULL;