-- Delete duplicates, keeping the most recently updated row per (organization_id, vertical_id)
DELETE FROM timesheet_thresholds
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id, COALESCE(vertical_id, '00000000-0000-0000-0000-000000000000'))
    id
  FROM timesheet_thresholds
  ORDER BY organization_id, COALESCE(vertical_id, '00000000-0000-0000-0000-000000000000'), updated_at DESC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_timesheet_thresholds_org_vertical
  ON timesheet_thresholds (organization_id, COALESCE(vertical_id, '00000000-0000-0000-0000-000000000000'));