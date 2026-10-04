-- Solicitor assigned to follow up on a pledge.
-- Safe to re-run.

ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS solicitor_contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pledges_solicitor_contact_idx
  ON public.pledges (organization_id, solicitor_contact_id)
  WHERE solicitor_contact_id IS NOT NULL;

COMMENT ON COLUMN public.pledges.solicitor_contact_id IS
  'Contact assigned to follow up with the donor on this pledge.';
