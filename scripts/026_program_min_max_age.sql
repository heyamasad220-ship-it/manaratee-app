-- Program min/max age columns + backfill age_groups for customer eligibility display
-- Run in Supabase SQL Editor (safe to re-run)

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  ADD COLUMN IF NOT EXISTS max_age INTEGER;

ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_min_age_check;

ALTER TABLE public.programs
  ADD CONSTRAINT programs_min_age_check
  CHECK (min_age IS NULL OR (min_age >= 0 AND min_age <= 120));

ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_max_age_check;

ALTER TABLE public.programs
  ADD CONSTRAINT programs_max_age_check
  CHECK (
    max_age IS NULL
    OR (max_age >= 0 AND max_age <= 120)
  );

ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_age_range_check;

ALTER TABLE public.programs
  ADD CONSTRAINT programs_age_range_check
  CHECK (
    min_age IS NULL
    OR max_age IS NULL
    OR min_age <= max_age
  );

-- Sync age_groups labels from min/max where missing
UPDATE public.programs p
SET age_groups = ARRAY[
  CASE
    WHEN p.min_age IS NOT NULL AND p.max_age IS NOT NULL
      THEN 'Ages ' || p.min_age::text || '-' || p.max_age::text
    WHEN p.min_age IS NOT NULL
      THEN 'Ages ' || p.min_age::text || '+'
    WHEN p.max_age IS NOT NULL
      THEN 'Ages up to ' || p.max_age::text
  END
]::text[]
WHERE (p.age_groups IS NULL OR cardinality(p.age_groups) = 0)
  AND (p.min_age IS NOT NULL OR p.max_age IS NOT NULL);

SELECT
  COUNT(*) FILTER (WHERE min_age IS NOT NULL OR max_age IS NOT NULL) AS programs_with_age_bounds,
  COUNT(*) FILTER (
    WHERE cardinality(COALESCE(age_groups, '{}'::text[])) > 0
  ) AS programs_with_age_group_labels
FROM public.programs;
