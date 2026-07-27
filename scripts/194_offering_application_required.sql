-- =============================================================================
-- 194_offering_application_required.sql
-- Enrollment path per offering:
--   application_required = true  → Apply → department approve → Register & pay
--   application_required = false → Register & pay immediately (no approval)
--
-- Run in Supabase SQL Editor after 193.
-- =============================================================================

ALTER TABLE public.program_offerings
  ADD COLUMN IF NOT EXISTS application_required BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.program_offerings.application_required IS
  'When true, customers apply and await approval before registering. When false, they register and pay immediately.';

-- Seasonal camps are typically open enrollment (register & pay).
UPDATE public.program_offerings o
SET
  application_required = false,
  updated_at = NOW()
FROM public.programs p
WHERE o.program_id = p.id
  AND o.organization_id = p.organization_id
  AND p.program_kind = 'seasonal'
  AND o.application_required IS DISTINCT FROM false;

SELECT
  p.program_kind,
  COUNT(*) AS offerings,
  COUNT(*) FILTER (WHERE o.application_required) AS require_application,
  COUNT(*) FILTER (WHERE NOT o.application_required) AS open_enrollment
FROM public.program_offerings o
JOIN public.programs p ON p.id = o.program_id
GROUP BY p.program_kind
ORDER BY p.program_kind;
