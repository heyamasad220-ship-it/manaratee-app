-- Contacts permission seeds (M2b / CR-7).
-- Run after 106_contact_notes_rls_policies.sql
-- Safe to re-run.

-- Admin / Super Admin: full CRM access
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, seed.permission_key, true
FROM public.organization_roles r
CROSS JOIN (
  VALUES
    ('contacts.view'),
    ('contacts.manage')
) AS seed(permission_key)
WHERE lower(r.name) IN ('super admin', 'admin')
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;

-- Cross-grant contacts.view from module permissions (idempotent)
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT DISTINCT
  rp.organization_id,
  rp.role_id,
  'contacts.view',
  true
FROM public.role_permissions rp
INNER JOIN (
  VALUES
    ('donations.view'),
    ('donations.manage'),
    ('bookings.view'),
    ('bookings.manage'),
    ('staff.view'),
    ('staff.manage'),
    ('programs.view'),
    ('programs.manage'),
    ('applications.view'),
    ('applications.manage'),
    ('vendor_hub.view'),
    ('vendor_hub.manage'),
    ('ticketing.view'),
    ('ticketing.manage')
) AS seed(source_key)
  ON rp.permission_key = seed.source_key
WHERE rp.enabled = true
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;

-- Facility roles: explicit deny (re-assert after seed)
UPDATE public.role_permissions rp
SET enabled = false
FROM public.organization_roles r
WHERE rp.role_id = r.id
  AND lower(r.name) IN ('facility manager', 'facility coordinator')
  AND rp.permission_key IN ('contacts.view', 'contacts.manage');
