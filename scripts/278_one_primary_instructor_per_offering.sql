-- One active offering-level primary instructor per class.
-- Duplicate primaries made the Offerings list and offering overview disagree
-- (list kept the newest name; overview showed the oldest).
-- Run after 031_program_staff_assignments.sql.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organization_id, offering_id
      ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.program_staff_assignments
  WHERE is_active = true
    AND assignment_role = 'primary_instructor'
    AND session_id IS NULL
)
UPDATE public.program_staff_assignments AS psa
SET
  is_active = false,
  updated_at = NOW()
FROM ranked
WHERE psa.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS program_staff_assignments_one_offering_primary
  ON public.program_staff_assignments (organization_id, offering_id)
  WHERE is_active = true
    AND assignment_role = 'primary_instructor'
    AND session_id IS NULL;

COMMENT ON INDEX public.program_staff_assignments_one_offering_primary IS
  'At most one active offering-level primary instructor per offering.';
