-- Fund Development granular permissions.
-- Run after scripts/264_campaign_group_checkout.sql. Safe to re-run.
--
-- donations.manage still implies full access in the app.
-- These seeds enable the new checkboxes for existing managers and Admin / Super Admin.

-- 1) Roles that already manage donations
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT rp.organization_id, rp.role_id, seed.permission_key, true
FROM public.role_permissions rp
CROSS JOIN (
  VALUES
    ('donations.campaigns.manage'),
    ('donations.prospects.manage'),
    ('donations.reports.manage')
) AS seed(permission_key)
WHERE rp.permission_key = 'donations.manage'
  AND rp.enabled = true
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = true;

-- 2) Admin / Super Admin in orgs with Fund Development (donations) enabled
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, seed.permission_key, true
FROM public.organization_roles r
JOIN public.organization_modules om
  ON om.organization_id = r.organization_id
  AND om.enabled = true
JOIN public.modules m
  ON m.id = om.module_id
  AND m.slug = 'donations'
CROSS JOIN (
  VALUES
    ('donations.campaigns.manage'),
    ('donations.prospects.manage'),
    ('donations.reports.manage')
) AS seed(permission_key)
WHERE lower(trim(r.name)) IN ('super admin', 'admin')
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = true;
