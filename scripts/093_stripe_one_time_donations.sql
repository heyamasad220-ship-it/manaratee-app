-- Stripe one-time donation checkout (canonical payments only).
-- Run after 092_recurring_donations.sql

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_pi_unique_idx
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_org_processor_idx
  ON public.payments (organization_id, source_type, payment_date DESC)
  WHERE source_type = 'processor';

CREATE TABLE IF NOT EXISTS public.donation_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  checkout_type TEXT NOT NULL CHECK (checkout_type IN ('one_time', 'pledge', 'recurring_setup')),
  stripe_checkout_session_id TEXT,
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.donation_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.donation_subcategories(id) ON DELETE SET NULL,
  pledge_id UUID REFERENCES public.pledges(id) ON DELETE SET NULL,
  recurring_donation_plan_id UUID REFERENCES public.recurring_donation_plans(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'complete', 'expired', 'failed')),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS donation_checkout_sessions_stripe_cs_unique_idx
  ON public.donation_checkout_sessions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS donation_checkout_sessions_org_status_idx
  ON public.donation_checkout_sessions (organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_processor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  stripe_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  stripe_object_id TEXT,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  checkout_session_id UUID REFERENCES public.donation_checkout_sessions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL DEFAULT 'processed'
    CHECK (processing_status IN ('processed', 'ignored', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stripe_event_id)
);

CREATE INDEX IF NOT EXISTS payment_processor_events_org_type_idx
  ON public.payment_processor_events (organization_id, event_type, created_at DESC);

ALTER TABLE public.donation_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_processor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage donation checkout sessions" ON public.donation_checkout_sessions;
CREATE POLICY "Org members manage donation checkout sessions"
  ON public.donation_checkout_sessions FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers view own donation checkout sessions" ON public.donation_checkout_sessions;
CREATE POLICY "Customers view own donation checkout sessions"
  ON public.donation_checkout_sessions FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members view processor events" ON public.payment_processor_events;
CREATE POLICY "Org members view processor events"
  ON public.payment_processor_events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS donation_checkout_sessions_updated_at ON public.donation_checkout_sessions;
CREATE TRIGGER donation_checkout_sessions_updated_at
  BEFORE UPDATE ON public.donation_checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.donation_checkout_sessions IS
  'In-flight Stripe Checkout state — not a payment ledger. Money lands in payments via webhook.';

COMMENT ON TABLE public.payment_processor_events IS
  'Stripe webhook audit log and idempotency guard for donation processor events.';
