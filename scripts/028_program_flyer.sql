-- Program flyer image support
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS flyer_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('program-flyers', 'program-flyers', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Organization members can upload program flyers" ON storage.objects;
CREATE POLICY "Organization members can upload program flyers"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'program-flyers'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Organization members can update program flyers" ON storage.objects;
CREATE POLICY "Organization members can update program flyers"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'program-flyers'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Organization members can delete program flyers" ON storage.objects;
CREATE POLICY "Organization members can delete program flyers"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'program-flyers'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Public read access for program flyers" ON storage.objects;
CREATE POLICY "Public read access for program flyers"
ON storage.objects
FOR SELECT
USING (bucket_id = 'program-flyers');
