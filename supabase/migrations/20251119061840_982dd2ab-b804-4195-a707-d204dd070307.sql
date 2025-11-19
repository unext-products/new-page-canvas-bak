-- Migration 1: Add new enum values to app_role
-- This must be done in a separate transaction before they can be used

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'org_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'program_manager';