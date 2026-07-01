-- Supabase Storage: course-materials bucket + RLS
--
-- MANUAL STEP (do in Supabase Dashboard → Storage):
--   1. Create bucket named: course-materials
--   2. Set Public: false (private bucket)
--   3. Upload the PDF at path: pdfs/cfa-framework.pdf
--
-- Then run this SQL in the SQL editor:

CREATE POLICY "enrolled users can read pdfs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'course-materials'
    AND auth.role() = 'authenticated'
  );
