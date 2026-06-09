-- Seed events.view / events.manage for roles that already have programs access
-- Run after 038_event_management_navigation.sql (safe to re-run)

INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT rp.organization_id, rp.role_id, seed.permission_key, true
FROM public.role_permissions rp
CROSS JOIN (
  VALUES
    ('events.view', 'programs.view'),
    ('events.manage', 'programs.manage')
) AS seed(permission_key, source_key)
WHERE rp.permission_key = seed.source_key
  AND rp.enabled = true
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;
