-- Leave type enum
CREATE TYPE leave_type AS ENUM ('sick_leave', 'casual_leave', 'vacation', 'personal', 'compensatory', 'other');

-- Leave days table
CREATE TABLE leave_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id),
  leave_date DATE NOT NULL,
  leave_type leave_type NOT NULL,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, leave_date)
);

-- RLS policies
ALTER TABLE leave_days ENABLE ROW LEVEL SECURITY;

-- Faculty can view their own leave days
CREATE POLICY "Faculty can view own leaves"
  ON leave_days FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Faculty can insert their own leave days
CREATE POLICY "Faculty can create leaves"
  ON leave_days FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Faculty can delete their own leave days
CREATE POLICY "Faculty can delete own leaves"
  ON leave_days FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- HOD can view leaves in their department
CREATE POLICY "HOD can view department leaves"
  ON leave_days FOR SELECT
  TO authenticated
  USING (
    (get_user_role(auth.uid()) = 'hod' AND department_id = get_user_department(auth.uid())) OR
    get_user_role(auth.uid()) = 'admin'
  );

-- Admin can view all leaves
CREATE POLICY "Admin can view all leaves"
  ON leave_days FOR SELECT
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- Indexes for performance
CREATE INDEX idx_leave_days_user_id ON leave_days(user_id);
CREATE INDEX idx_leave_days_date ON leave_days(leave_date);
CREATE INDEX idx_leave_days_department ON leave_days(department_id);