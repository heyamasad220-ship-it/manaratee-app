-- Declined card charges. A failed attempt is not a payment.
-- Run after 313_enable_giving_groups.sql

CREATE TABLE IF NOT EXISTS public.donation_charge_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  pledge_id UUID REFERENCES public.pledges(id) ON DELETE SET NULL,
  recurring_donation_plan_id UUID REFERENCES public.recurring_donation_plans(id) ON DELETE SET NULL,
  checkout_session_id UUID REFERENCES public.donation_checkout_sessions(id) ON DELETE SET NULL,
  charge_kind TEXT NOT NULL CHECK (charge_kind IN ('one_time', 'pledge', 'recurring')),
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_charge_id TEXT,
  decline_code TEXT,
  failure_code TEXT,
  failure_message TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS donation_charge_failures_payment_intent_uidx
  ON public.donation_charge_failures (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donation_charge_failures_invoice_uidx
  ON public.donation_charge_failures (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS donation_charge_failures_org_occurred_idx
  ON public.donation_charge_failures (organization_id, occurred_at DESC);

ALTER TABLE public.donation_charge_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view donation charge failures" ON public.donation_charge_failures;
CREATE POLICY "Staff view donation charge failures"
  ON public.donation_charge_failures FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

COMMENT ON TABLE public.donation_charge_failures IS
  'Card charges the bank declined. Not a payment and not included in collected totals. Written by the Stripe webhook.';
