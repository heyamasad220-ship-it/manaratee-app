-- Facility Manager and Facility Coordinator roles (Facilities module access only)
-- Safe to re-run

INSERT INTO public.organization_roles (organization_id, name, description, is_system_role)
SELECT
  o.id,
  seed.name,
  seed.description,
  true
FROM public.organizations o
CROSS JOIN (
  VALUES
    (
      'Facility Manager',
      'Manages spaces and facility setup. Access limited to the Facilities module.'
    ),
    (
      'Facility Coordinator',
      'Views facility setup, master calendar, and reservation center. Access limited to the Facilities module.'
    )
) AS seed(name, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organization_roles r
  WHERE r.organization_id = o.id
    AND lower(r.name) = lower(seed.name)
);

INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, 'spaces.view', true
FROM public.organization_roles r
WHERE lower(r.name) IN ('facility manager', 'facility coordinator')
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;

INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, 'spaces.manage', true
FROM public.organization_roles r
WHERE lower(r.name) = 'facility manager'
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;

-- Ensure facility roles do not inherit broad module access from legacy seeds.
UPDATE public.role_permissions rp
SET enabled = false
FROM public.organization_roles r
WHERE rp.role_id = r.id
  AND lower(r.name) IN ('facility manager', 'facility coordinator')
  AND rp.permission_key IN (
    'settings.users.view',
    'settings.users.manage',
    'settings.roles.view',
    'settings.roles.manage',
    'applications.view',
    'applications.manage',
    'programs.view',
    'programs.manage',
    'staff.view',
    'staff.manage',
    'donations.view',
    'donations.manage',
    'reports.view',
    'events.view',
    'events.manage',
    'bookings.view',
    'bookings.manage',
    'finance.view',
    'finance.manage',
    'contacts.view',
    'contacts.manage',
    'ticketing.view',
    'ticketing.manage',
    'vendor_hub.view',
    'vendor_hub.manage'
  );
