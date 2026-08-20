-- Optional structured fields for event Staff assignments (rate, hours, paid, certificate).
-- Safe to re-run. App also falls back to notes JSON if column is missing.

ALTER TABLE public.service_participations
  ADD COLUMN IF NOT EXISTS assignment_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.service_participations.assignment_meta IS
  'Event staff assignment extras: hourlyRate, hours, paidAt, certificateSentAt.';
