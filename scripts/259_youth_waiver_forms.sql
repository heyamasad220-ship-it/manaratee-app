-- Youth waiver / photo consent on childcare registrations.
-- Run after 258_ticket_order_refunded_amount.sql. Safe to re-run.

ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS waiver_signed_at TIMESTAMPTZ;

ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS waiver_signed_by TEXT;

ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS photo_consent BOOLEAN;

COMMENT ON COLUMN public.childcare_registrations.waiver_signed_at IS
  'When a guardian signed the youth liability waiver for this registration.';

COMMENT ON COLUMN public.childcare_registrations.waiver_signed_by IS
  'Guardian name recorded with the youth liability waiver.';

COMMENT ON COLUMN public.childcare_registrations.photo_consent IS
  'True when a guardian granted photo/video consent for this child.';

NOTIFY pgrst, 'reload schema';
