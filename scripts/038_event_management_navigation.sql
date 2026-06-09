-- Event Management module + sidebar group regroup (Phase 0 navigation)
-- Run in Supabase SQL Editor after 037_internal_events_foundation.sql
-- Safe to re-run; adapts to modules.price_monthly vs modules.monthly_price column names

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RETURN;
  END IF;

  -- Regroup existing modules
  UPDATE public.modules SET group_name = 'People'
  WHERE slug IN ('contacts', 'hr');

  UPDATE public.modules SET group_name = 'Operations'
  WHERE slug IN ('programs', 'bookings', 'event-management', 'spaces');

  UPDATE public.modules SET group_name = 'Services'
  WHERE slug IN ('ticketing', 'bazaar', 'vendor-hub');

  UPDATE public.modules SET group_name = 'Financial'
  WHERE slug IN ('donations');

  UPDATE public.modules
  SET name = 'Venue Rentals'
  WHERE slug = 'bookings'
    AND name IN ('Bookings', 'bookings');

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'price_monthly'
  ) THEN
    INSERT INTO public.modules (
      code,
      name,
      slug,
      description,
      route,
      icon_name,
      group_name,
      sort_order,
      is_core,
      is_active,
      default_enabled,
      price_monthly,
      price_yearly
    )
    VALUES (
      'event-management',
      'Event Management',
      'event-management',
      'Internal department-owned events and operations',
      '/event-management/overview',
      'LayoutGrid',
      'Operations',
      40,
      false,
      true,
      true,
      0,
      0
    )
    ON CONFLICT (slug) DO UPDATE SET
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      route = EXCLUDED.route,
      icon_name = EXCLUDED.icon_name,
      group_name = EXCLUDED.group_name,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      default_enabled = EXCLUDED.default_enabled;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'monthly_price'
  ) THEN
    INSERT INTO public.modules (
      code,
      name,
      slug,
      description,
      route,
      icon_name,
      group_name,
      sort_order,
      is_core,
      is_active,
      default_enabled,
      monthly_price,
      yearly_price
    )
    VALUES (
      'event-management',
      'Event Management',
      'event-management',
      'Internal department-owned events and operations',
      '/event-management/overview',
      'LayoutGrid',
      'Operations',
      40,
      false,
      true,
      true,
      0,
      0
    )
    ON CONFLICT (slug) DO UPDATE SET
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      route = EXCLUDED.route,
      icon_name = EXCLUDED.icon_name,
      group_name = EXCLUDED.group_name,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      default_enabled = EXCLUDED.default_enabled;
  ELSE
    INSERT INTO public.modules (
      code,
      name,
      slug,
      description,
      route,
      icon_name,
      group_name,
      sort_order,
      is_core,
      is_active,
      default_enabled
    )
    VALUES (
      'event-management',
      'Event Management',
      'event-management',
      'Internal department-owned events and operations',
      '/event-management/overview',
      'LayoutGrid',
      'Operations',
      40,
      false,
      true,
      true
    )
    ON CONFLICT (slug) DO UPDATE SET
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      route = EXCLUDED.route,
      icon_name = EXCLUDED.icon_name,
      group_name = EXCLUDED.group_name,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      default_enabled = EXCLUDED.default_enabled;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_modules'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    INSERT INTO public.organization_modules (organization_id, module_id, enabled)
    SELECT DISTINCT om.organization_id, mod.id, true
    FROM public.organization_modules om
    JOIN public.modules mod ON mod.slug = 'event-management'
    WHERE om.enabled = true
    ON CONFLICT (organization_id, module_id)
    DO UPDATE SET enabled = true;
  END IF;
END $$;

-- If 038 was already applied, ensure Event Management icon/group are correct
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    UPDATE public.modules
    SET group_name = 'Operations',
        icon_name = 'LayoutGrid',
        route = '/event-management/overview'
    WHERE slug = 'event-management';

    UPDATE public.modules SET group_name = 'Operations'
    WHERE slug IN ('programs', 'bookings');
  END IF;
END $$;
