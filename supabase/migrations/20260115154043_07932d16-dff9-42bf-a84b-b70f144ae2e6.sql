
-- Phase 1A: Add new roles to the app_role enum only
-- These need to be committed before using them in functions

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'l3';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'l2';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'l1';
