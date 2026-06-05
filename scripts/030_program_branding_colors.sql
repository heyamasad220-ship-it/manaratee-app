-- Program branding colors for catalog / customer display
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS background_color TEXT,
  ADD COLUMN IF NOT EXISTS title_color TEXT,
  ADD COLUMN IF NOT EXISTS subtitle_color TEXT;
