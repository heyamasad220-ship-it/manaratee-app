-- Align the sellable module catalog with staff navigation.
-- Workforce/Administration is core (always on). Finance is included with Programs.
-- Display names match the staff product: Directory, Fund Development, Venue Rentals, Facilities.
-- Safe to re-run in the Supabase SQL Editor after 272.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'modules'
      AND column_name = 'slug'
  ) THEN
    RAISE NOTICE 'modules.slug missing — aborting 273';
    RETURN;
  END IF;

  -- Display names (DB slug unchanged)
  UPDATE public.modules
  SET
    name = CASE slug
      WHEN 'contacts' THEN 'Directory'
      WHEN 'workforce' THEN 'Administration'
      WHEN 'hr' THEN 'Administration'
      WHEN 'donations' THEN 'Fund Development'
      WHEN 'bookings' THEN 'Venue Rentals'
      WHEN 'spaces' THEN 'Facilities'
      WHEN 'event-management' THEN 'Event Management'
      WHEN 'vendor-hub' THEN 'Vendor Hub'
      WHEN 'programs' THEN 'Programs'
      WHEN 'membership' THEN 'Membership'
      WHEN 'finance' THEN 'Finance'
      ELSE name
    END,
    description = CASE slug
      WHEN 'workforce' THEN 'Staff directory, departments, and people operations (included with every organization)'
      WHEN 'finance' THEN 'Program billing, payroll, and financial assistance (included with Programs)'
      WHEN 'spaces' THEN 'Facilities calendar and spaces (included with Programs, Event Management, Venue Rentals, or Vendor Hub)'
      WHEN 'donations' THEN 'Donor engagement, pledges, campaigns, and fundraising'
      WHEN 'bookings' THEN 'Venue rental requests, agreements, and payments'
      ELSE description
    END
  WHERE slug IN (
    'contacts',
    'workforce',
    'hr',
    'donations',
    'bookings',
    'spaces',
    'event-management',
    'vendor-hub',
    'programs',
    'membership',
    'finance'
  );

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'is_core'
  ) THEN
    UPDATE public.modules
    SET is_core = true
    WHERE slug IN ('dashboard', 'contacts', 'settings', 'workforce');

    UPDATE public.modules
    SET is_core = false
    WHERE slug IN ('finance', 'hr');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'is_core'
  ) THEN
    UPDATE public.modules
    SET is_core = true
    WHERE slug IN ('dashboard', 'contacts', 'settings', 'workforce');

    UPDATE public.modules
    SET is_core = false
    WHERE slug IN ('finance', 'hr');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'include_in_catalog'
  ) THEN
    UPDATE public.modules
    SET include_in_catalog = true
    WHERE slug IN (
      'event-management',
      'programs',
      'vendor-hub',
      'bookings',
      'donations',
      'membership'
    );

    UPDATE public.modules
    SET include_in_catalog = false
    WHERE slug IN (
      'dashboard',
      'contacts',
      'settings',
      'workforce',
      'finance',
      'hr',
      'ticketing',
      'spaces',
      'community-calendar',
      'sign-ups',
      'child-care',
      'bazaar',
      'reports',
      'applications'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'include_in_catalog'
  ) THEN
    UPDATE public.modules
    SET include_in_catalog = true
    WHERE slug IN (
      'event-management',
      'programs',
      'vendor-hub',
      'bookings',
      'donations',
      'membership'
    );

    UPDATE public.modules
    SET include_in_catalog = false
    WHERE slug IN (
      'dashboard',
      'contacts',
      'settings',
      'workforce',
      'finance',
      'hr',
      'ticketing',
      'spaces',
      'community-calendar',
      'sign-ups',
      'child-care',
      'bazaar',
      'reports',
      'applications'
    );
  END IF;
END $$;

-- Enable Administration (workforce) for every organization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_modules'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.organization_modules (
    organization_id,
    module_id,
    enabled,
    enabled_by_plan,
    manually_overridden
  )
  SELECT
    orgs.id,
    workforce.id,
    true,
    false,
    false
  FROM public.organizations orgs
  JOIN public.modules workforce ON workforce.slug = 'workforce'
  ON CONFLICT (organization_id, module_id) DO UPDATE
    SET enabled = true;

  -- Include Finance wherever Programs is already enabled
  INSERT INTO public.organization_modules (
    organization_id,
    module_id,
    enabled,
    enabled_by_plan,
    manually_overridden
  )
  SELECT
    om.organization_id,
    finance.id,
    true,
    false,
    false
  FROM public.organization_modules om
  JOIN public.modules programs ON programs.id = om.module_id AND programs.slug = 'programs'
  JOIN public.modules finance ON finance.slug = 'finance'
  WHERE om.enabled = true
  ON CONFLICT (organization_id, module_id) DO UPDATE
    SET enabled = true;

  -- Turn Finance off when Programs is not enabled
  UPDATE public.organization_modules om
  SET enabled = false
  FROM public.modules finance
  WHERE finance.id = om.module_id
    AND finance.slug = 'finance'
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_modules programs_om
      JOIN public.modules programs ON programs.id = programs_om.module_id
      WHERE programs_om.organization_id = om.organization_id
        AND programs.slug = 'programs'
        AND programs_om.enabled = true
    );

  -- Include Facilities with Programs, Event Management, Venue Rentals, or Vendor Hub
  INSERT INTO public.organization_modules (
    organization_id,
    module_id,
    enabled,
    enabled_by_plan,
    manually_overridden
  )
  SELECT DISTINCT
    om.organization_id,
    spaces.id,
    true,
    false,
    false
  FROM public.organization_modules om
  JOIN public.modules parent ON parent.id = om.module_id
    AND parent.slug IN ('programs', 'event-management', 'bookings', 'vendor-hub')
  JOIN public.modules spaces ON spaces.slug = 'spaces'
  WHERE om.enabled = true
  ON CONFLICT (organization_id, module_id) DO UPDATE
    SET enabled = true;

  -- Turn Facilities off when none of those operations modules are enabled
  UPDATE public.organization_modules om
  SET enabled = false
  FROM public.modules spaces
  WHERE spaces.id = om.module_id
    AND spaces.slug = 'spaces'
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_modules parent_om
      JOIN public.modules parent ON parent.id = parent_om.module_id
      WHERE parent_om.organization_id = om.organization_id
        AND parent.slug IN ('programs', 'event-management', 'bookings', 'vendor-hub')
        AND parent_om.enabled = true
    );
END $$;

-- Seed Community Calendar as a capability (included with Vendor Hub or Event Management)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.modules
  SET
    name = 'Community Calendar',
    route = '/community-calendar',
    icon_name = 'Calendar',
    group_name = 'Operations',
    sort_order = 55,
    is_active = true,
    default_enabled = false,
    description = 'Public community calendar (included with Vendor Hub or Event Management)'
  WHERE slug = 'community-calendar';

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'price_monthly'
    ) THEN
      INSERT INTO public.modules (
        code, name, slug, description, route, icon_name, group_name, sort_order,
        is_core, is_active, default_enabled, price_monthly, price_yearly
      )
      VALUES (
        'community-calendar', 'Community Calendar', 'community-calendar',
        'Public community calendar (included with Vendor Hub or Event Management)',
        '/community-calendar', 'Calendar', 'Operations', 55,
        false, true, false, 0, 0
      );
    ELSE
      INSERT INTO public.modules (
        code, name, slug, description, route, icon_name, group_name, sort_order,
        is_core, is_active, default_enabled
      )
      VALUES (
        'community-calendar', 'Community Calendar', 'community-calendar',
        'Public community calendar (included with Vendor Hub or Event Management)',
        '/community-calendar', 'Calendar', 'Operations', 55,
        false, true, false
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'include_in_catalog'
  ) THEN
    UPDATE public.modules
    SET include_in_catalog = false
    WHERE slug = 'community-calendar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'is_core'
  ) THEN
    UPDATE public.modules
    SET is_core = false
    WHERE slug = 'community-calendar';
  END IF;
END $$;

-- Include Community Calendar with Vendor Hub or Event Management
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_modules'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.organization_modules (
    organization_id,
    module_id,
    enabled,
    enabled_by_plan,
    manually_overridden
  )
  SELECT DISTINCT
    om.organization_id,
    calendar.id,
    true,
    false,
    false
  FROM public.organization_modules om
  JOIN public.modules parent ON parent.id = om.module_id
    AND parent.slug IN ('event-management', 'vendor-hub')
  JOIN public.modules calendar ON calendar.slug = 'community-calendar'
  WHERE om.enabled = true
  ON CONFLICT (organization_id, module_id) DO UPDATE
    SET enabled = true;

  UPDATE public.organization_modules om
  SET enabled = false
  FROM public.modules calendar
  WHERE calendar.id = om.module_id
    AND calendar.slug = 'community-calendar'
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_modules parent_om
      JOIN public.modules parent ON parent.id = parent_om.module_id
      WHERE parent_om.organization_id = om.organization_id
        AND parent.slug IN ('event-management', 'vendor-hub')
        AND parent_om.enabled = true
    );
END $$;

-- Keep persona bundle rows in sync with the TypeScript catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscription_bundles'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.subscription_bundles
  SET
    description = 'Full operations suite — events, programs, vendors, venue rentals, giving, and membership.',
    module_slugs = ARRAY[
      'event-management',
      'programs',
      'vendor-hub',
      'bookings',
      'donations',
      'membership'
    ],
    updated_at = NOW()
  WHERE slug IN ('community-center', 'community_center');
END $$;
