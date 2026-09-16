-- Program Lead: one Directory person who can open this program workspace
-- and see all of its offerings without org-wide programs.view.
-- Run after 289_remove_program_transaction_fee_addons.sql

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS lead_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.programs.lead_contact_id IS
  'Directory person who is Program Lead for this year/season. May open this program workspace and see all offerings without org-wide programs.view.';

CREATE INDEX IF NOT EXISTS programs_org_lead_contact_idx
  ON public.programs (organization_id, lead_contact_id)
  WHERE lead_contact_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

