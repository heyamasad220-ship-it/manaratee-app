-- M6b: membership permission seeds + events cross-grant for contacts.view.
-- Run after 109_contacts_rls_gate_alignment.sql
-- Safe to re-run.

-- Admin / Super Admin: full membership access
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, seed.permission_key, true
FROM public.organization_roles r
CROSS JOIN (
  VALUES
    ('membership.view'),
    ('membership.manage')
) AS seed(permission_key)
WHERE lower(r.name) IN ('super admin', 'admin')
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;

-- Cross-grant contacts.view from membership + events permissions
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT DISTINCT
  rp.organization_id,
  rp.role_id,
  'contacts.view',
  true
FROM public.role_permissions rp
INNER JOIN (
  VALUES
    ('membership.view'),
    ('membership.manage'),
    ('events.view'),
    ('events.manage')
) AS seed(source_key)
  ON rp.permission_key = seed.source_key
WHERE rp.enabled = true
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;

-- Facility roles: explicit deny (re-assert)
UPDATE public.role_permissions rp
SET enabled = false
FROM public.organization_roles r
WHERE rp.role_id = r.id
  AND lower(r.name) IN ('facility manager', 'facility coordinator')
  AND rp.permission_key IN (
    'contacts.view',
    'contacts.manage',
    'membership.view',
    'membership.manage'
  );
