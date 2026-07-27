-- Allow year/season programs to be Closed (visible for reports) instead of only Archived.
-- Closed = finished year, still in department workspace. Archived = legacy read-only closeout.

ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_status_check;

ALTER TABLE public.programs
  ADD CONSTRAINT programs_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'closed', 'archived'));
