-- Module catalog flags, subscription bundles metadata, and org module sync
-- Run in Supabase SQL Editor after 066_ticketing_under_event_management.sql
-- Safe to re-run

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'modules'
      AND column_name = 'include_in_catalog'
  ) THEN
    ALTER TABLE public.modules
      ADD COLUMN include_in_catalog BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'subscription_bundle_slug'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN subscription_bundle_slug TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.modules.include_in_catalog IS
  'When false, module is a core or capability module — hidden from subscription catalog toggles.';

COMMENT ON COLUMN public.organizations.subscription_bundle_slug IS
  'Last persona bundle applied by platform admin (community-center, school, venue, etc.).';

-- Core modules (always on, not sold separately)
UPDATE public.modules
SET
  is_core = true,
  default_enabled = true,
  include_in_catalog = false,
  is_active = true
WHERE slug IN ('dashboard', 'contacts', 'settings');

-- Billable product modules
UPDATE public.modules
SET
  is_core = false,
  include_in_catalog = true,
  is_active = true
WHERE slug IN (
  'event-management',
  'programs',
  'vendor-hub',
  'bookings',
  'donations',
  'workforce',
  'membership'
);

-- Capability / legacy modules — not sold separately
UPDATE public.modules
SET
  is_core = false,
  include_in_catalog = false,
  is_active = true
WHERE slug IN (
  'ticketing',
  'spaces',
  'sign-ups',
  'child-care',
  'bazaar',
  'hr',
  'reports',
  'applications'
);

-- Retire legacy bazaar from sidebar licensing (vendor-hub is the product module)
UPDATE public.modules
SET
  is_active = false,
  include_in_catalog = false,
  description = COALESCE(description, '') || ' (legacy — use Vendor Hub)'
WHERE slug = 'bazaar';

UPDATE public.modules
SET description = 'Event ticketing and sales (included with Event Management)'
WHERE slug = 'ticketing';

UPDATE public.modules
SET description = 'Facilities reservation center (included with Venue Rentals)'
WHERE slug = 'spaces';

-- Map orgs that had legacy bazaar enabled to vendor-hub
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_modules'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.organization_modules (organization_id, module_id, enabled, enabled_by_plan, manually_overridden)
  SELECT
    om.organization_id,
    vendor.id,
    true,
    false,
    false
  FROM public.organization_modules om
  JOIN public.modules legacy ON legacy.id = om.module_id AND legacy.slug = 'bazaar'
  JOIN public.modules vendor ON vendor.slug = 'vendor-hub'
  WHERE om.enabled = true
  ON CONFLICT (organization_id, module_id) DO UPDATE
    SET enabled = true;

  -- Auto-enable ticketing where event-management is enabled
  INSERT INTO public.organization_modules (organization_id, module_id, enabled, enabled_by_plan, manually_overridden)
  SELECT
    om.organization_id,
    ticketing.id,
    true,
    false,
    false
  FROM public.organization_modules om
  JOIN public.modules em ON em.id = om.module_id AND em.slug = 'event-management'
  JOIN public.modules ticketing ON ticketing.slug = 'ticketing'
  WHERE om.enabled = true
  ON CONFLICT (organization_id, module_id) DO UPDATE
    SET enabled = true;

  -- Auto-enable spaces where bookings (Venue Rentals) is enabled
  INSERT INTO public.organization_modules (organization_id, module_id, enabled, enabled_by_plan, manually_overridden)
  SELECT
    om.organization_id,
    spaces.id,
    true,
    false,
    false
  FROM public.organization_modules om
  JOIN public.modules bookings ON bookings.id = om.module_id AND bookings.slug = 'bookings'
  JOIN public.modules spaces ON spaces.slug = 'spaces'
  WHERE om.enabled = true
  ON CONFLICT (organization_id, module_id) DO UPDATE
    SET enabled = true;

  -- Map legacy hr slug rows to workforce if both exist
  INSERT INTO public.organization_modules (organization_id, module_id, enabled, enabled_by_plan, manually_overridden)
  SELECT
    om.organization_id,
    workforce.id,
    true,
    false,
    false
  FROM public.organization_modules om
  JOIN public.modules legacy ON legacy.id = om.module_id AND legacy.slug = 'hr'
  JOIN public.modules workforce ON workforce.slug = 'workforce'
  WHERE om.enabled = true
  ON CONFLICT (organization_id, module_id) DO UPDATE
    SET enabled = true;
END $$;

-- Seed subscription bundle reference table (mirrors lib/modules/module-catalog.ts)
CREATE TABLE IF NOT EXISTS public.subscription_bundles (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  module_slugs TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_bundles (slug, name, description, module_slugs, sort_order)
VALUES
  (
    'community-center',
    'Community Center',
    'Full operations suite for community centers.',
    ARRAY['event-management', 'programs', 'vendor-hub', 'bookings', 'donations', 'workforce', 'membership'],
    10
  ),
  (
    'school',
    'School / Education',
    'Campus programs and department events.',
    ARRAY['programs', 'event-management'],
    20
  ),
  (
    'bazaar-organizer',
    'Bazaar / Marketplace',
    'Vendor marketplace with supporting event operations.',
    ARRAY['vendor-hub', 'event-management'],
    30
  ),
  (
    'venue',
    'Venue / Rentals',
    'Reservation center and rental workflows.',
    ARRAY['bookings'],
    40
  ),
  (
    'nonprofit',
    'Nonprofit',
    'Donor engagement and fundraising.',
    ARRAY['donations'],
    50
  ),
  (
    'faith-membership',
    'Faith + Membership',
    'Member directory, teams, events, and giving.',
    ARRAY['membership', 'donations', 'event-management'],
    60
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  module_slugs = EXCLUDED.module_slugs,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = NOW();

COMMENT ON TABLE public.subscription_bundles IS
  'Persona presets for platform admins. Application logic uses lib/modules/module-catalog.ts; this table is reference/reporting.';
