-- Add childcare_provider contact affiliation role
-- Run after 061_contact_affiliation_manual.sql

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
    'service_provider',
    'childcare_provider'
  ));

COMMENT ON TABLE public.contact_roles IS
  'Contact affiliations. Derived roles (donor, vendor, volunteer, employee, member, childcare_provider) sync from activity; staff may override manual labels.';
