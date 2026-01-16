-- Change activity_type column from enum to text for flexibility with custom categories
ALTER TABLE timesheet_entries ALTER COLUMN activity_type TYPE text USING activity_type::text;

-- Drop existing L3 SELECT policy
DROP POLICY IF EXISTS "L3 can view entries in their verticals" ON timesheet_entries;

-- Create updated L3 SELECT policy that falls back to user_verticals when vertical_id is NULL
CREATE POLICY "L3 can view entries in their verticals"
  ON timesheet_entries
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) = 'l3'::app_role) AND
    (
      -- Match by vertical_id if present
      (vertical_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM user_verticals uv
        WHERE uv.user_id = auth.uid() AND uv.vertical_id = timesheet_entries.vertical_id
      ))
      OR
      -- Fall back to matching by entry owner's vertical assignments
      (vertical_id IS NULL AND EXISTS (
        SELECT 1 FROM user_verticals entry_owner_uv
        WHERE entry_owner_uv.user_id = timesheet_entries.user_id
        AND entry_owner_uv.vertical_id = ANY(get_user_verticals(auth.uid()))
      ))
    ) AND
    (EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = timesheet_entries.user_id AND ur.role = ANY (ARRAY['l1'::app_role, 'l2'::app_role])
    ))
  );

-- Drop existing L3 UPDATE policy
DROP POLICY IF EXISTS "L3 can update entries in their verticals" ON timesheet_entries;

-- Create updated L3 UPDATE policy with same fallback logic
CREATE POLICY "L3 can update entries in their verticals"
  ON timesheet_entries
  FOR UPDATE
  USING (
    (get_user_role(auth.uid()) = 'l3'::app_role) AND
    (
      -- Match by vertical_id if present
      (vertical_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM user_verticals uv
        WHERE uv.user_id = auth.uid() AND uv.vertical_id = timesheet_entries.vertical_id
      ))
      OR
      -- Fall back to matching by entry owner's vertical assignments
      (vertical_id IS NULL AND EXISTS (
        SELECT 1 FROM user_verticals entry_owner_uv
        WHERE entry_owner_uv.user_id = timesheet_entries.user_id
        AND entry_owner_uv.vertical_id = ANY(get_user_verticals(auth.uid()))
      ))
    ) AND
    (EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = timesheet_entries.user_id AND ur.role = ANY (ARRAY['l1'::app_role, 'l2'::app_role])
    ))
  );