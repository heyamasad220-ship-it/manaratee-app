-- Allow staff assignments on service_participations (event Staff tab).
-- Reuses volunteer_role as the assigned task name.
-- Safe to re-run.

ALTER TABLE public.service_participations
  DROP CONSTRAINT IF EXISTS service_participations_participation_type_check;

ALTER TABLE public.service_participations
  ADD CONSTRAINT service_participations_participation_type_check
  CHECK (
    participation_type IN (
      'volunteer',
      'childcare_provider',
      'vendor',
      'staff'
    )
  );

COMMENT ON COLUMN public.service_participations.participation_type IS
  'volunteer | childcare_provider | vendor | staff. staff = manager-assigned event staff; volunteer_role holds task name.';

COMMENT ON COLUMN public.service_participations.volunteer_role IS
  'Task or role name for volunteer/staff assignments (and optional notes for other types).';
