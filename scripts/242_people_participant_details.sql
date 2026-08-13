-- Person-centric participant details shared by Participant profile and Contact Family.
-- Safe to re-run.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS photo_consent TEXT;

COMMENT ON COLUMN public.people.allergies IS
  'Participant allergies / medical notes (person-level; mirrored into enrollment notes on edit).';
COMMENT ON COLUMN public.people.emergency_contact IS
  'Emergency contact display line (name and/or phone) for program participants.';
COMMENT ON COLUMN public.people.photo_consent IS
  'Photo consent label (e.g. Yes / No) for program participants.';
