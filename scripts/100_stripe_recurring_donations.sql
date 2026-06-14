-- Stripe recurring donation subscription billing (canonical payments + recurring_donation_plans).
-- Run after 093_stripe_one_time_donations.sql

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_invoice_unique_idx
  ON public.payments (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

ALTER TABLE public.recurring_donation_plans
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS recurring_donation_plans_stripe_sub_idx
  ON public.recurring_donation_plans (external_processor_id)
  WHERE external_processor = 'stripe' AND external_processor_id IS NOT NULL;

-- Allow pending_setup (pre-checkout) and past_due (failed invoice) plan statuses.
ALTER TABLE public.recurring_donation_plans
  DROP CONSTRAINT IF EXISTS recurring_donation_plans_status_check;

ALTER TABLE public.recurring_donation_plans
  ADD CONSTRAINT recurring_donation_plans_status_check
  CHECK (status IN ('pending_setup', 'active', 'paused', 'past_due', 'cancelled', 'completed'));

COMMENT ON COLUMN public.payments.stripe_invoice_id IS
  'Stripe Invoice ID for recurring subscription charges — idempotency key for invoice webhooks.';

COMMENT ON COLUMN public.recurring_donation_plans.stripe_customer_id IS
  'Stripe Customer ID linked when donor completes recurring Checkout setup.';
