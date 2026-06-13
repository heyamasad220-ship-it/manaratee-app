-- Recurring donation plans (separate from pledges). Canonical payments for money received.
-- Run after 091_pledge_reminders.sql

CREATE TABLE IF NOT EXISTS public.recurring_donation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES public.donors(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.donation_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.donation_subcategories(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL
    CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annually')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
  start_date DATE NOT NULL,
  next_payment_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  external_processor TEXT,
  external_processor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recurring_donation_plans_org_status_idx
  ON public.recurring_donation_plans (organization_id, status);

CREATE INDEX IF NOT EXISTS recurring_donation_plans_org_donor_idx
  ON public.recurring_donation_plans (organization_id, donor_id);

CREATE INDEX IF NOT EXISTS recurring_donation_plans_org_next_date_idx
  ON public.recurring_donation_plans (organization_id, next_payment_date)
  WHERE status = 'active';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS recurring_donation_plan_id UUID
    REFERENCES public.recurring_donation_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_recurring_plan_idx
  ON public.payments (recurring_donation_plan_id)
  WHERE recurring_donation_plan_id IS NOT NULL;

ALTER TABLE public.recurring_donation_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage recurring donation plans" ON public.recurring_donation_plans;
CREATE POLICY "Org members manage recurring donation plans"
  ON public.recurring_donation_plans FOR ALL
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

DROP TRIGGER IF EXISTS recurring_donation_plans_updated_at ON public.recurring_donation_plans;
CREATE TRIGGER recurring_donation_plans_updated_at
  BEFORE UPDATE ON public.recurring_donation_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.recurring_donation_plans IS
  'Recurring donation commitments — not pledges. Actual gifts recorded in payments.recurring_donation_plan_id.';

COMMENT ON COLUMN public.payments.recurring_donation_plan_id IS
  'Links a canonical payment to a recurring donation plan when staff records a scheduled gift.';
