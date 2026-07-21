-- S3: Scope program_schedule_items to offerings.
-- Run in Supabase SQL Editor AFTER 177_program_capacity_groups_offering.sql
-- See docs/programs-offering-attributes-migration.md

-- ---------------------------------------------------------------------------
-- 1) Add offering_id (nullable until backfill)
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_schedule_items
  ADD COLUMN IF NOT EXISTS offering_id UUID
    REFERENCES public.program_offerings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS program_schedule_items_offering_id_idx
  ON public.program_schedule_items(offering_id);

COMMENT ON COLUMN public.program_schedule_items.offering_id IS
  'Offering that owns this weekly schedule slot (S3). program_id retained for program-wide reads.';

-- ---------------------------------------------------------------------------
-- 2) Backfill: default offering, else first non-archived offering
-- ---------------------------------------------------------------------------
UPDATE public.program_schedule_items AS s
SET offering_id = o.id
FROM public.program_offerings AS o
WHERE s.offering_id IS NULL
  AND o.program_id = s.program_id
  AND o.organization_id = s.organization_id
  AND o.is_default = true;

UPDATE public.program_schedule_items AS s
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
WHERE s.offering_id IS NULL
  AND o.program_id = s.program_id
  AND o.organization_id = s.organization_id;

-- Orphan rows (program has no offerings)
DELETE FROM public.program_schedule_items
WHERE offering_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Require offering_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_schedule_items
  ALTER COLUMN offering_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Smoke checks
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS schedule_items,
  COUNT(*) FILTER (WHERE offering_id IS NOT NULL) AS with_offering
FROM public.program_schedule_items;
