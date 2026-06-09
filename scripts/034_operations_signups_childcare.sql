-- Register Sign-Ups + Child Care under Operations and enable for active orgs
-- Run in Supabase SQL Editor (safe to re-run)
-- Adapts to modules.price_monthly vs modules.monthly_price column names

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
    VALUES
      (
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
      ),
      (
        'child-care',
        'Child Care',
        'child-care',
        'Childcare providers and event registrations',
        '/child-care/providers',
        'Baby',
        'Operations',
        46,
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
      default_enabled = true;
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
    VALUES
      (
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
      ),
      (
        'child-care',
        'Child Care',
        'child-care',
        'Childcare providers and event registrations',
        '/child-care/providers',
        'Baby',
        'Operations',
        46,
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
      default_enabled = true;
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
    VALUES
      (
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
      ),
      (
        'child-care',
        'Child Care',
        'child-care',
        'Childcare providers and event registrations',
        '/child-care/providers',
        'Baby',
        'Operations',
        46,
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
      default_enabled = true;
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
    JOIN public.modules mod ON mod.slug IN ('sign-ups', 'child-care')
    WHERE om.enabled = true
    ON CONFLICT (organization_id, module_id)
    DO UPDATE SET enabled = true;
  END IF;
END $$;
