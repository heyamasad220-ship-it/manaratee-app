-- Venue card branding: color swatch + flyer image
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS flyer_url TEXT;

COMMENT ON COLUMN public.venues.color IS
  'Hex color used on Spaces cards when no flyer is set.';

COMMENT ON COLUMN public.venues.flyer_url IS
  'Public URL for the venue flyer / photo (uploaded to program-flyers storage).';

UPDATE public.venues
SET color = '#3b82f6'
WHERE color IS NULL OR TRIM(color) = '';

-- Refresh PostgREST so inserts/updates see the new columns immediately.
NOTIFY pgrst, 'reload schema';
