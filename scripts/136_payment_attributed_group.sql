-- Optional group attribution on individual gifts (group competition rollups).
-- Run after 135_contact_group_members.sql

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS attributed_group_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_org_attributed_group_idx
  ON public.payments (organization_id, attributed_group_contact_id)
  WHERE attributed_group_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_group_member_contact_idx
  ON public.payments (organization_id, attributed_group_contact_id, contact_id)
  WHERE attributed_group_contact_id IS NOT NULL AND contact_id IS NOT NULL;

COMMENT ON COLUMN public.payments.attributed_group_contact_id IS
  'When set on an individual gift, the payment counts toward this group total. Donor of record stays on contact_id.';
