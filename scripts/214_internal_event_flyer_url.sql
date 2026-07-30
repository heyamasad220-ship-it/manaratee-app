-- Optional promotional flyer for internal events (event workspace Overview).
-- Reuses the existing public `program-flyers` storage bucket from scripts/028_program_flyer.sql.

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS flyer_url TEXT;

COMMENT ON COLUMN public.internal_events.flyer_url IS
  'Public URL for the event flyer image (uploaded to program-flyers storage).';

NOTIFY pgrst, 'reload schema';
