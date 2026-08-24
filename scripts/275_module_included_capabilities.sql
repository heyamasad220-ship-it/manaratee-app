-- Persist which capability modules are included with each product SKU.
-- Super Admin add/edit module dialog reads and writes this column.
-- Safe to re-run in the Supabase SQL Editor after 274.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'modules'
      AND column_name = 'included_capability_slugs'
  ) THEN
    ALTER TABLE public.modules
      ADD COLUMN included_capability_slugs TEXT[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

COMMENT ON COLUMN public.modules.included_capability_slugs IS
  'Capability module slugs enabled automatically when this product module is subscribed. Edited from Super Admin → Modules.';

-- Seed built-in product modules only when the array is still empty.
UPDATE public.modules
SET included_capability_slugs = CASE slug
  WHEN 'event-management' THEN ARRAY[
    'ticketing',
    'spaces',
    'community-calendar',
    'sign-ups',
    'child-care'
  ]
  WHEN 'programs' THEN ARRAY[
    'spaces',
    'finance',
    'sign-ups',
    'child-care'
  ]
  WHEN 'vendor-hub' THEN ARRAY['spaces', 'community-calendar']
  WHEN 'bookings' THEN ARRAY['spaces']
  ELSE included_capability_slugs
END
WHERE slug IN (
  'event-management',
  'programs',
  'vendor-hub',
  'bookings',
  'donations',
  'membership'
)
  AND COALESCE(array_length(included_capability_slugs, 1), 0) = 0;
