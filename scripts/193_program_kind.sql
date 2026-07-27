-- =============================================================================
-- 193_program_kind.sql
-- Two create types under Programs:
--   academic  — year/season container + offerings (QIL-style)
--   seasonal  — one sellable season (camps); staff UI has no offerings layer
--
-- Run in Supabase SQL Editor after 192.
-- =============================================================================

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS program_kind TEXT NOT NULL DEFAULT 'academic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'programs_program_kind_check'
  ) THEN
    ALTER TABLE public.programs
      ADD CONSTRAINT programs_program_kind_check
      CHECK (program_kind IN ('academic', 'seasonal'));
  END IF;
END $$;

COMMENT ON COLUMN public.programs.program_kind IS
  'academic = year + offerings (QIL); seasonal = single camp/season product (no offerings chrome).';

-- Summer Camp 2026: seasonal kind + rename year to the season name.
UPDATE public.programs
SET
  program_kind = 'seasonal',
  name = 'Summer Camp 2026',
  updated_at = NOW()
WHERE id = 'e6436c28-666c-4327-b3c1-4234d2379a42'
  AND organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be';

-- Also clear inherit flags on the Summer Camp leaf so Registration/Participants
-- are editable as the season top level (no grayed inherit locks).
UPDATE public.program_offerings
SET
  name = 'Summer Camp 2026',
  inherit_dates = false,
  inherit_eligibility = false,
  inherit_enrollment = false,
  updated_at = NOW()
WHERE id = '6700239e-bbf5-49ae-90e6-0412b88a22c3'
  AND organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be';

-- Any other recreational camp years that still look like the merged survivor.
UPDATE public.programs p
SET program_kind = 'seasonal',
    updated_at = NOW()
WHERE p.program_kind = 'academic'
  AND EXISTS (
    SELECT 1
    FROM public.program_offerings o
    WHERE o.program_id = p.id
      AND o.status <> 'archived'
    GROUP BY o.program_id
    HAVING COUNT(*) = 1
  )
  AND (
    lower(p.name) LIKE '%camp%'
    OR lower(p.name) LIKE '%summer%'
    OR lower(p.name) LIKE '%winter%'
    OR lower(p.name) LIKE '%fall%'
    OR lower(p.name) LIKE '%spring%'
  );

SELECT
  id,
  name,
  program_kind
FROM public.programs
WHERE organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
  AND (
    id = 'e6436c28-666c-4327-b3c1-4234d2379a42'
    OR program_kind = 'seasonal'
  );
