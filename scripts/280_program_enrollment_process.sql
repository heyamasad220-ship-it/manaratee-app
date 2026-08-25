-- Program enrollment process: one engine, optional application/approval.
-- Maps offering.application_required onto program.enrollment_process.
-- Expands application statuses for evaluation / waitlist without dropping
-- submitted / not_approved (existing rows keep those values).
-- Run after 194_offering_application_required.sql.

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS enrollment_process TEXT,
  ADD COLUMN IF NOT EXISTS evaluation_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seat_activation_rule TEXT;

UPDATE public.programs p
SET
  enrollment_process = CASE
    WHEN p.program_kind = 'seasonal' THEN 'direct_registration'
    WHEN EXISTS (
      SELECT 1
      FROM public.program_offerings o
      WHERE o.program_id = p.id
        AND o.status IS DISTINCT FROM 'archived'
        AND o.application_required = true
    ) THEN 'application_approval'
    ELSE 'application_approval'
  END,
  seat_activation_rule = COALESCE(p.seat_activation_rule, 'on_registration'),
  evaluation_required = CASE
    WHEN p.name ILIKE 'QIL%' THEN true
    ELSE COALESCE(p.evaluation_required, false)
  END
WHERE p.enrollment_process IS NULL
   OR p.seat_activation_rule IS NULL;

ALTER TABLE public.programs
  ALTER COLUMN enrollment_process SET DEFAULT 'application_approval',
  ALTER COLUMN seat_activation_rule SET DEFAULT 'on_registration';

UPDATE public.programs
SET
  enrollment_process = COALESCE(enrollment_process, 'application_approval'),
  seat_activation_rule = COALESCE(seat_activation_rule, 'on_registration');

ALTER TABLE public.programs
  ALTER COLUMN enrollment_process SET NOT NULL,
  ALTER COLUMN seat_activation_rule SET NOT NULL;

ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_enrollment_process_check;
ALTER TABLE public.programs
  ADD CONSTRAINT programs_enrollment_process_check
  CHECK (enrollment_process IN ('direct_registration', 'application_approval'));

ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_seat_activation_rule_check;
ALTER TABLE public.programs
  ADD CONSTRAINT programs_seat_activation_rule_check
  CHECK (seat_activation_rule IN ('on_registration', 'after_initial_payment'));

COMMENT ON COLUMN public.programs.enrollment_process IS
  'direct_registration = register without applying; application_approval = apply then register.';
COMMENT ON COLUMN public.programs.evaluation_required IS
  'When true, application-based programs require an evaluation before approval.';
COMMENT ON COLUMN public.programs.seat_activation_rule IS
  'on_registration = Active on submit; after_initial_payment = Pending until first payment.';

-- Keep offering.application_required aligned with the year/season setting.
UPDATE public.program_offerings o
SET
  application_required = (p.enrollment_process = 'application_approval'),
  updated_at = NOW()
FROM public.programs p
WHERE o.program_id = p.id
  AND o.application_required IS DISTINCT FROM (p.enrollment_process = 'application_approval');

ALTER TABLE public.program_applications
  DROP CONSTRAINT IF EXISTS program_applications_status_check;
ALTER TABLE public.program_applications
  ADD CONSTRAINT program_applications_status_check
  CHECK (
    status IN (
      'draft',
      'submitted',
      'evaluation_required',
      'evaluation_scheduled',
      'evaluation_completed',
      'approved',
      'waitlisted',
      'not_approved',
      'declined',
      'withdrawn'
    )
  );

ALTER TABLE public.program_enrollments
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.program_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS program_enrollments_application_id_idx
  ON public.program_enrollments (application_id)
  WHERE application_id IS NOT NULL;

UPDATE public.program_enrollments e
SET application_id = a.id
FROM public.program_applications a
WHERE a.enrollment_id = e.id
  AND e.application_id IS NULL;

COMMENT ON COLUMN public.program_enrollments.application_id IS
  'Optional originating application. Approval does not create this enrollment.';
