-- Payment import foundation: persist CSV match hints and link payments to import batches.
-- Run after 116_donor_summary_view_contact_id.sql

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS import_email text,
  ADD COLUMN IF NOT EXISTS import_phone text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES public.payment_import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_import_batch_id
  ON public.payments (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_org_pending_import_match
  ON public.payments (organization_id, payment_date DESC)
  WHERE status IN ('pending_review', 'unallocated', 'unresolved');

COMMENT ON COLUMN public.payments.import_email IS
  'Email from CSV import used for contact matching; not necessarily the verified donor email.';

COMMENT ON COLUMN public.payments.import_phone IS
  'Phone from CSV import used for contact matching; stored as provided in the file.';

COMMENT ON COLUMN public.payments.import_batch_id IS
  'Optional link to payment_import_batches for import audit history.';
