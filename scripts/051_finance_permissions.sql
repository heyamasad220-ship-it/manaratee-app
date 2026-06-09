-- Finance permissions for payment/refund visibility (separate from operational briefs)
-- Run after 050_operational_briefs.sql
-- Safe to re-run
--
-- DISTINCT avoids duplicate (role_id, permission_key) rows when a role has
-- multiple source permissions (e.g. both donations.view and bookings.manage).

INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT DISTINCT
  rp.organization_id,
  rp.role_id,
  seed.permission_key,
  true
FROM public.role_permissions rp
INNER JOIN (
  VALUES
    ('finance.view', 'donations.view'),
    ('finance.view', 'bookings.manage'),
    ('finance.manage', 'donations.manage'),
    ('finance.manage', 'bookings.manage')
) AS seed(permission_key, source_key)
  ON rp.permission_key = seed.source_key
WHERE rp.enabled = true
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;
