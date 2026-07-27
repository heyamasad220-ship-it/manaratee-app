-- Department flyer image support
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS flyer_url TEXT;

COMMENT ON COLUMN public.departments.flyer_url IS
  'Public URL for the department flyer image (uploaded to program-flyers storage).';
