-- Summer Camp uses the same enrollment engine as academic years, with Direct Registration.
-- Do not change QIL (Application & Approval). Run after 280_program_enrollment_process.sql.

UPDATE public.programs
SET
  enrollment_process = 'direct_registration',
  evaluation_required = false,
  updated_at = NOW()
WHERE id = 'e6436c28-666c-4327-b3c1-4234d2379a42'
  AND name = 'Summer Camp 2026'
  AND enrollment_process IS DISTINCT FROM 'direct_registration';

UPDATE public.program_offerings o
SET
  application_required = false,
  updated_at = NOW()
FROM public.programs p
WHERE o.program_id = p.id
  AND p.id = 'e6436c28-666c-4327-b3c1-4234d2379a42'
  AND o.status IS DISTINCT FROM 'archived'
  AND o.application_required IS DISTINCT FROM false;
