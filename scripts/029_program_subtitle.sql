-- Program subtitle (short tagline under program name)
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS subtitle TEXT;
