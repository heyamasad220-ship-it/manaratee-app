-- =============================================================================
-- 236_program_application_answers.sql
-- Structured applicant answers on program_applications (separate from staff
-- evaluation_notes). Keys: previous_courses, previous_certificates,
-- prior_background, prior_center_name, needs_babysitter, payment_preference.
-- =============================================================================

ALTER TABLE public.program_applications
  ADD COLUMN IF NOT EXISTS application_answers JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.program_applications.application_answers IS
  'Applicant form answers (JSONB). Keys include previous_courses, previous_certificates, prior_background, prior_center_name, needs_babysitter, payment_preference, requested_offering_ids. Staff evaluation notes stay in evaluation_notes.';
