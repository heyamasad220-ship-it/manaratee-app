-- Ensure venue_rentals.billing_contact_id exists (required by sync_contact_affiliations in 137).
-- Safe to re-run. Run after 054_organization_contacts.sql if that was skipped.

ALTER TABLE public.venue_rentals
  ADD COLUMN IF NOT EXISTS billing_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS venue_rentals_org_billing_contact_idx
  ON public.venue_rentals(organization_id, billing_contact_id)
  WHERE billing_contact_id IS NOT NULL;

COMMENT ON COLUMN public.venue_rentals.billing_contact_id IS
  'Organization or person contact billed for this rental. Used for org rental history on contact profiles.';
