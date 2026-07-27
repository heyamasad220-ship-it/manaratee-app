-- Participant school grade (e.g. upcoming grade from camp roster).
-- Safe to re-run.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS grade TEXT;

COMMENT ON COLUMN public.people.grade IS
  'Current or upcoming school grade label (e.g. Kindergarten, 3rd Grade). Optional.';
