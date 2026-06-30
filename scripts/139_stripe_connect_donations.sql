-- Stripe Connect Express: per-organization donation payout accounts.
-- Run after 138_contact_payment_methods.sql

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_connect_account_unique_idx
  ON public.organizations (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

COMMENT ON COLUMN public.organizations.stripe_connect_account_id IS
  'Stripe Connect Express account id — donations settle to this connected account.';

COMMENT ON COLUMN public.organizations.stripe_connect_charges_enabled IS
  'Mirrors Stripe Account.charges_enabled for donation checkout gating.';

COMMENT ON COLUMN public.organizations.stripe_connect_payouts_enabled IS
  'Mirrors Stripe Account.payouts_enabled for staff status display.';

COMMENT ON COLUMN public.organizations.stripe_connect_details_submitted IS
  'Mirrors Stripe Account.details_submitted from Connect onboarding.';

COMMENT ON COLUMN public.organizations.stripe_connect_onboarded_at IS
  'When Connect onboarding first reached charges_enabled + details_submitted.';
