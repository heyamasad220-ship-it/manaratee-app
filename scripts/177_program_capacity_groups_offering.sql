-- S2: Scope program_capacity_groups to offerings.
-- Run in Supabase SQL Editor AFTER 176_program_offering_attributes.sql
-- See docs/programs-offering-attributes-migration.md

-- ---------------------------------------------------------------------------
-- 1) Add offering_id (nullable until backfill)
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_capacity_groups
  ADD COLUMN IF NOT EXISTS offering_id UUID
    REFERENCES public.program_offerings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS program_capacity_groups_offering_id_idx
  ON public.program_capacity_groups(offering_id);

COMMENT ON COLUMN public.program_capacity_groups.offering_id IS
  'Offering that owns this capacity group (S2). program_id retained for queries.';

-- ---------------------------------------------------------------------------
-- 2) Backfill: default offering, else first non-archived offering
-- ---------------------------------------------------------------------------
UPDATE public.program_capacity_groups AS g
SET offering_id = o.id
FROM public.program_offerings AS o
WHERE g.offering_id IS NULL
  AND o.program_id = g.program_id
  AND o.organization_id = g.organization_id
  AND o.is_default = true;

UPDATE public.program_capacity_groups AS g
SET offering_id = o.id
FROM (
  SELECT DISTINCT ON (program_id, organization_id)
    id,
    program_id,
    organization_id
  FROM public.program_offerings
  WHERE status <> 'archived'
  ORDER BY
    program_id,
    organization_id,
    is_default DESC,
    created_at ASC NULLS LAST
) AS o
WHERE g.offering_id IS NULL
  AND o.program_id = g.program_id
  AND o.organization_id = g.organization_id;

-- Orphan groups (program has no offerings) cannot be kept once offering_id is required
DELETE FROM public.program_capacity_groups
WHERE offering_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Require offering_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_capacity_groups
  ALTER COLUMN offering_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Align offering capacity from groups (youth multi-bucket programs)
-- ---------------------------------------------------------------------------
WITH group_totals AS (
  SELECT
    offering_id,
    organization_id,
    SUM(capacity)::integer AS total_capacity
  FROM public.program_capacity_groups
  GROUP BY offering_id, organization_id
)
UPDATE public.program_offerings AS o
SET
  capacity_mode = CASE
    WHEN gt.total_capacity > 0 THEN 'limited'
    ELSE COALESCE(o.capacity_mode, 'unlimited')
  END,
  capacity = CASE
    WHEN gt.total_capacity > 0 THEN gt.total_capacity
    ELSE o.capacity
  END,
  updated_at = NOW()
FROM group_totals AS gt
WHERE o.id = gt.offering_id
  AND o.organization_id = gt.organization_id;

-- Catalog temporary: program.capacity = sum of limited offerings
WITH offering_sums AS (
  SELECT
    program_id,
    organization_id,
    COALESCE(
      SUM(capacity) FILTER (WHERE capacity_mode = 'limited' AND capacity IS NOT NULL),
      0
    )::integer AS total_capacity
  FROM public.program_offerings
  WHERE status <> 'archived'
  GROUP BY program_id, organization_id
)
UPDATE public.programs AS p
SET
  capacity = os.total_capacity,
  updated_at = NOW()
FROM offering_sums AS os
WHERE p.id = os.program_id
  AND p.organization_id = os.organization_id;

-- ---------------------------------------------------------------------------
-- 5) Smoke checks
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS capacity_groups,
  COUNT(*) FILTER (WHERE offering_id IS NOT NULL) AS with_offering
FROM public.program_capacity_groups;

SELECT
  COUNT(*) AS offerings_with_groups
FROM (
  SELECT DISTINCT offering_id
  FROM public.program_capacity_groups
) t;
