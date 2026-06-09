-- Membership module sidebar registration
-- Run after 057_memberships.sql
-- Safe to re-run

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
      'membership',
      'Membership',
      'membership',
      'MAS members, teams, and member benefits',
      '/membership',
      'UserCheck',
      'People',
      36,
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
      'membership',
      'Membership',
      'membership',
      'MAS members, teams, and member benefits',
      '/membership',
      'UserCheck',
      'People',
      36,
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
  END IF;
END $$;

-- Enable for organizations that already have Contacts
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
    SELECT DISTINCT om.organization_id, m.id, true
    FROM public.organization_modules om
    JOIN public.modules contacts_mod ON contacts_mod.slug = 'contacts' AND contacts_mod.id = om.module_id
    JOIN public.modules m ON m.slug = 'membership'
    WHERE om.enabled = true
    ON CONFLICT (organization_id, module_id)
    DO UPDATE SET enabled = true;
  END IF;
END $$;
