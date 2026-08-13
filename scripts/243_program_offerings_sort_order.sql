-- Custom drag-and-drop order for program offerings within a program.
-- Run in Supabase SQL Editor.

ALTER TABLE public.program_offerings
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.program_offerings.sort_order IS
  'Staff display order within a program (lower first). Set via Offerings list drag-and-drop.';

-- Backfill only rows still at the default so re-runs do not clobber custom order.
WITH ranked AS (
  SELECT
    id,
    (
      ROW_NUMBER() OVER (
        PARTITION BY organization_id, program_id
        ORDER BY name ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
      ) * 10
    ) AS next_sort
  FROM public.program_offerings
  WHERE sort_order = 0
)
UPDATE public.program_offerings AS offering
SET sort_order = ranked.next_sort
FROM ranked
WHERE offering.id = ranked.id
  AND offering.sort_order = 0;

CREATE INDEX IF NOT EXISTS program_offerings_org_program_sort_idx
  ON public.program_offerings (organization_id, program_id, sort_order);
