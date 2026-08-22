-- Manual Sponsor role on canonical contacts (not a separate identity table).
-- Run after 175_split_customer_programs_affiliation.sql
-- Sponsor is staff-assigned; it is not derived by affiliation sync.

ALTER TABLE public.contact_roles
  DROP CONSTRAINT IF EXISTS contact_roles_role_check;

ALTER TABLE public.contact_roles
  ADD CONSTRAINT contact_roles_role_check
  CHECK (role IN (
    'donor',
    'customer',
    'program_participant',
    'volunteer',
    'employee',
    'member',
    'vendor',
    'service_provider',
    'childcare_provider',
    'sponsor'
  ));

COMMENT ON TABLE public.contact_roles IS
  'Contact roles. Derived roles sync from module activity; staff may override manual labels (is_manual). Sticky: donor, volunteer, vendor, customer, program_participant. Manual: service_provider, sponsor.';
