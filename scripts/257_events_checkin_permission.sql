-- Fine-grained event door-staff permission: events.checkin
-- Run after 256_customer_ticket_order_rls.sql. Safe to re-run.
--
-- events.manage / ticketing.manage still include check-in in the app.
-- This seed turns the Roles & Permissions checkbox on for existing managers
-- and Admin / Super Admin. For door staff, enable events.view + events.checkin
-- (and leave events.manage off).

-- 1) Roles that already manage events
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT rp.organization_id, rp.role_id, 'events.checkin', true
FROM public.role_permissions rp
WHERE rp.permission_key = 'events.manage'
  AND rp.enabled = true
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = true;

-- 2) Admin / Super Admin in orgs with Event Management enabled
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, 'events.checkin', true
FROM public.organization_roles r
JOIN public.organization_modules om
  ON om.organization_id = r.organization_id
  AND om.enabled = true
JOIN public.modules m
  ON m.id = om.module_id
  AND m.slug = 'event-management'
WHERE lower(trim(r.name)) IN ('super admin', 'admin')
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = true;
