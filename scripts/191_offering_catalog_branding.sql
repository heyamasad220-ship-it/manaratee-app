-- Offering catalog branding (flyer + placeholder background color)
-- Run in Supabase SQL Editor after 190.

ALTER TABLE public.program_offerings
  ADD COLUMN IF NOT EXISTS flyer_url TEXT,
  ADD COLUMN IF NOT EXISTS background_color TEXT;

COMMENT ON COLUMN public.program_offerings.flyer_url IS
  'Optional catalog flyer image URL for this sellable program.';

COMMENT ON COLUMN public.program_offerings.background_color IS
  'Hex color for catalog placeholder when flyer_url is empty (staff-picked).';
