-- Live-site columns used by staff header and Super Admin modules.
-- Safe to re-run. Does not change department rows.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

UPDATE public.profiles
SET full_name = NULLIF(btrim(concat_ws(' ', first_name, last_name)), '')
WHERE full_name IS NULL
   OR btrim(full_name) = '';

COMMENT ON COLUMN public.profiles.full_name IS
  'Display name copied from first_name + last_name.';

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS included_capability_slugs TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.modules.included_capability_slugs IS
  'Capability module slugs enabled automatically when this product module is subscribed.';

UPDATE public.modules
SET included_capability_slugs = CASE slug
  WHEN 'event-management' THEN ARRAY[
    'ticketing',
    'spaces',
    'community-calendar',
    'sign-ups',
    'child-care',
    'workforce'
  ]
  WHEN 'programs' THEN ARRAY[
    'spaces',
    'finance',
    'sign-ups',
    'child-care',
    'workforce'
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
