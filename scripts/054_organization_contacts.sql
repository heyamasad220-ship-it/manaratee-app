-- Organization contacts: primary contact person + rental billing linkage
-- Run after 053_internal_event_approval.sql
-- Safe to re-run

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT;

COMMENT ON COLUMN public.contacts.primary_contact_name IS
  'Main point-of-contact person for organization-type contacts.';

ALTER TABLE public.venue_rentals
  ADD COLUMN IF NOT EXISTS billing_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS venue_rentals_org_billing_contact_idx
  ON public.venue_rentals(organization_id, billing_contact_id)
  WHERE billing_contact_id IS NOT NULL;

COMMENT ON COLUMN public.venue_rentals.billing_contact_id IS
  'Organization or person contact billed for this rental. Used for org rental history on contact profiles.';
