-- Vendor Hub contact-centric model (additive, non-destructive)
-- Run in Supabase SQL Editor after 075_vendor_hub_events_internal_link.sql
--
-- Principle: CRM contacts are the only vendor identity.
-- vendor_hub_vendors and duplicate contact fields must not be used for new data.

ALTER TABLE public.vendor_hub_booth_assignments
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE RESTRICT;

ALTER TABLE public.vendor_hub_payments
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_hub_booth_assignments_contact_idx
  ON public.vendor_hub_booth_assignments(contact_id);

CREATE INDEX IF NOT EXISTS vendor_hub_payments_contact_idx
  ON public.vendor_hub_payments(contact_id);

CREATE INDEX IF NOT EXISTS vendor_hub_participant_status_contact_idx
  ON public.vendor_hub_participant_status(contact_id);

-- Backfill assignments from legacy vendor_hub_vendors.contact_id when that column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendor_hub_vendors'
      AND column_name = 'contact_id'
  ) THEN
    UPDATE public.vendor_hub_booth_assignments ba
    SET contact_id = v.contact_id
    FROM public.vendor_hub_vendors v
    WHERE ba.vendor_id = v.id
      AND ba.contact_id IS NULL
      AND v.contact_id IS NOT NULL;
  END IF;
END $$;

-- Backfill payments from assignments
UPDATE public.vendor_hub_payments p
SET contact_id = ba.contact_id
FROM public.vendor_hub_booth_assignments ba
WHERE p.booth_assignment_id = ba.id
  AND p.contact_id IS NULL
  AND ba.contact_id IS NOT NULL;

-- Backfill participant status from applications
UPDATE public.vendor_hub_participant_status ps
SET contact_id = a.contact_id
FROM public.applications a
WHERE ps.application_id = a.id
  AND ps.contact_id IS NULL
  AND a.contact_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_hub_booth_assignments.contact_id IS
  'CRM contact participating in this booth assignment. Required for new rows.';

COMMENT ON COLUMN public.vendor_hub_payments.contact_id IS
  'CRM contact this payment belongs to. Required for new rows.';

COMMENT ON TABLE public.vendor_hub_participant_status IS
  'Event participation facts keyed by CRM contact_id. Do not create parallel vendor identities.';
