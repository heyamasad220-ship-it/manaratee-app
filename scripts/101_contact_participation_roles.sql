-- Contact participation roles: program_participant, event_attendee, venue_rental_customer
-- Run after 100_stripe_recurring_donations.sql

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
    'childcare_provider',
    'program_participant',
    'event_attendee',
    'venue_rental_customer'
  ));

COMMENT ON TABLE public.contact_roles IS
  'Contact affiliations. Derived roles sync from module activity; staff may override manual labels (is_manual). Sticky participation roles: donor, volunteer, vendor, event_attendee, program_participant, venue_rental_customer.';
