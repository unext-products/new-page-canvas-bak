
-- Create storage bucket for sample timesheet files
INSERT INTO storage.buckets (id, name, public) VALUES ('sample-timesheets', 'sample-timesheets', true);

-- Allow authenticated users to read/download sample files
CREATE POLICY "Anyone can view sample timesheets" ON storage.objects FOR SELECT USING (bucket_id = 'sample-timesheets');

-- Allow org admins and super admins to upload/update/delete sample files
CREATE POLICY "Admins can upload sample timesheets" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'sample-timesheets' AND (
    (SELECT public.get_user_role(auth.uid())) = 'org_admin' OR
    public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "Admins can update sample timesheets" ON storage.objects FOR UPDATE USING (
  bucket_id = 'sample-timesheets' AND (
    (SELECT public.get_user_role(auth.uid())) = 'org_admin' OR
    public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "Admins can delete sample timesheets" ON storage.objects FOR DELETE USING (
  bucket_id = 'sample-timesheets' AND (
    (SELECT public.get_user_role(auth.uid())) = 'org_admin' OR
    public.is_super_admin(auth.uid())
  )
);
