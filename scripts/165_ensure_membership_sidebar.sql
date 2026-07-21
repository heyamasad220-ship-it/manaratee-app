-- Ensure Membership module exists and appears in the staff sidebar (between HR and Donations).
-- Safe to re-run in Supabase SQL Editor.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RAISE NOTICE 'modules.slug missing — aborting';
    RETURN;
  END IF;

  UPDATE public.modules
  SET
    name = 'Membership',
    route = '/membership',
    icon_name = 'UserCheck',
    group_name = 'People',
    sort_order = 25,
    is_active = true,
    default_enabled = true
  WHERE slug = 'membership';

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
        'membership', 'Membership', 'membership',
        'MAS members, teams, and member benefits',
        '/membership', 'UserCheck', 'People', 25,
        false, true, true, 0, 0
      );
    ELSE
      INSERT INTO public.modules (
        code, name, slug, description, route, icon_name, group_name, sort_order,
        is_core, is_active, default_enabled
      )
      VALUES (
        'membership', 'Membership', 'membership',
        'MAS members, teams, and member benefits',
        '/membership', 'UserCheck', 'People', 25,
        false, true, true
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'include_in_catalog'
  ) THEN
    UPDATE public.modules
    SET include_in_catalog = true
    WHERE slug = 'membership';
  END IF;
END $$;

-- Enable Membership for orgs that already have Contacts or HR (workforce) enabled.
INSERT INTO public.organization_modules (organization_id, module_id, enabled, enabled_by_plan, manually_overridden)
SELECT DISTINCT om.organization_id, m.id, true, true, true
FROM public.organization_modules om
JOIN public.modules seed ON seed.id = om.module_id
  AND seed.slug IN ('contacts', 'workforce', 'hr')
  AND om.enabled = true
JOIN public.modules m ON m.slug = 'membership'
ON CONFLICT (organization_id, module_id)
DO UPDATE SET
  enabled = true,
  enabled_by_plan = COALESCE(public.organization_modules.enabled_by_plan, true),
  manually_overridden = true;

-- Seed membership permissions for Admin / Super Admin roles when missing.
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, p.permission_key, true
FROM public.organization_roles r
CROSS JOIN (
  VALUES ('membership.view'), ('membership.manage')
) AS p(permission_key)
WHERE lower(r.name) IN ('admin', 'super admin', 'owner')
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;
