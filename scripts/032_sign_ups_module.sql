-- Sign-Ups module under Operations; volunteer management lives at /sign-ups/volunteers
-- Run in Supabase SQL Editor after 031_program_staff_assignments.sql
-- Safe to re-run; adapts to modules.price_monthly vs modules.monthly_price column names

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RETURN;
  END IF;

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
      'sign-ups',
      'Sign-Ups',
      'sign-ups',
      'Volunteer sign-ups for events and activities',
      '/sign-ups/overview',
      'ClipboardList',
      'Operations',
      45,
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
      'sign-ups',
      'Sign-Ups',
      'sign-ups',
      'Volunteer sign-ups for events and activities',
      '/sign-ups/overview',
      'ClipboardList',
      'Operations',
      45,
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
      'sign-ups',
      'Sign-Ups',
      'sign-ups',
      'Volunteer sign-ups for events and activities',
      '/sign-ups/overview',
      'ClipboardList',
      'Operations',
      45,
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

-- Enable Sign-Ups for orgs that already have People Management (hr)
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
    SELECT om.organization_id, signups.id, om.enabled
    FROM public.organization_modules om
    JOIN public.modules hr ON hr.id = om.module_id AND hr.slug = 'hr'
    JOIN public.modules signups ON signups.slug = 'sign-ups'
    ON CONFLICT (organization_id, module_id) DO UPDATE SET enabled = EXCLUDED.enabled;
  END IF;
END $$;
