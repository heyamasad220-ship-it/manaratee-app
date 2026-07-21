-- Ensure Event Management appears in the staff sidebar when enabled for an org.
-- Safe to re-run in Supabase SQL Editor.
--
-- Diagnose first (optional):
--   SELECT m.slug, m.is_active, m.route, om.enabled, o.name
--   FROM public.modules m
--   LEFT JOIN public.organization_modules om ON om.module_id = m.id
--   LEFT JOIN public.organizations o ON o.id = om.organization_id
--   WHERE m.slug IN ('event-management', 'ticketing')
--   ORDER BY o.name NULLS FIRST, m.slug;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RAISE NOTICE 'modules.slug missing — aborting';
    RETURN;
  END IF;

  -- Keep catalog row active with the sidebar route the app expects
  UPDATE public.modules
  SET
    name = 'Event Management',
    route = '/event-management/overview',
    icon_name = 'LayoutGrid',
    group_name = 'Operations',
    sort_order = 40,
    is_active = true,
    default_enabled = true
  WHERE slug = 'event-management';

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
        'event-management', 'Event Management', 'event-management',
        'Internal department-owned events and operations',
        '/event-management/overview', 'LayoutGrid', 'Operations', 40,
        false, true, true, 0, 0
      );
    ELSE
      INSERT INTO public.modules (
        code, name, slug, description, route, icon_name, group_name, sort_order,
        is_core, is_active, default_enabled
      )
      VALUES (
        'event-management', 'Event Management', 'event-management',
        'Internal department-owned events and operations',
        '/event-management/overview', 'LayoutGrid', 'Operations', 40,
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
    WHERE slug = 'event-management';
  END IF;

  UPDATE public.modules
  SET is_active = true
  WHERE slug = 'ticketing';
END $$;

-- Enable Event Management (+ ticketing) for every org that already has an
-- organization_modules row for it, and create the row when missing for orgs
-- that have Programs or Ticketing enabled (common setup gap).
INSERT INTO public.organization_modules (organization_id, module_id, enabled, enabled_by_plan, manually_overridden)
SELECT DISTINCT om.organization_id, em.id, true, false, true
FROM public.organization_modules om
JOIN public.modules src ON src.id = om.module_id
CROSS JOIN public.modules em
WHERE em.slug = 'event-management'
  AND src.slug IN ('event-management', 'programs', 'ticketing')
  AND om.enabled = true
ON CONFLICT (organization_id, module_id)
DO UPDATE SET enabled = true;

INSERT INTO public.organization_modules (organization_id, module_id, enabled, enabled_by_plan, manually_overridden)
SELECT DISTINCT om.organization_id, t.id, true, false, false
FROM public.organization_modules om
JOIN public.modules em ON em.id = om.module_id AND em.slug = 'event-management' AND om.enabled = true
CROSS JOIN public.modules t
WHERE t.slug = 'ticketing'
ON CONFLICT (organization_id, module_id)
DO UPDATE SET enabled = true;

-- Seed Admin / Super Admin permissions for orgs with Event Management enabled
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, seed.permission_key, true
FROM public.organization_roles r
JOIN public.organization_modules om
  ON om.organization_id = r.organization_id
  AND om.enabled = true
JOIN public.modules m
  ON m.id = om.module_id
  AND m.slug = 'event-management'
CROSS JOIN (
  VALUES
    ('events.view'),
    ('events.manage'),
    ('ticketing.view'),
    ('ticketing.manage'),
    ('reports.view')
) AS seed(permission_key)
WHERE lower(trim(r.name)) IN ('super admin', 'admin')
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = true;
