-- Re-add customer affiliation for organization contacts (venue renters)
-- Run after 054_organization_contacts.sql
-- Safe to re-run

ALTER TABLE public.contact_roles
  DROP CONSTRAINT IF EXISTS contact_roles_role_check;

ALTER TABLE public.contact_roles
  ADD CONSTRAINT contact_roles_role_check
  CHECK (role IN (
    'donor',
    'customer',
    'volunteer',
    'employee',
    'member',
    'vendor',
    'service_provider'
  ));

COMMENT ON TABLE public.contact_roles IS
  'Contact affiliations. Organizations use donor, customer (venue renter), and service_provider. People use the full set.';
