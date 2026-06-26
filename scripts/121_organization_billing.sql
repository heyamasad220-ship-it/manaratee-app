-- Organization platform billing: payment methods and invoice history
-- Run after 120_donations_pilot_blocker_totals.sql

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

COMMENT ON COLUMN public.organizations.stripe_customer_id IS
  'Stripe Customer id for Manaratee platform subscription billing.';

COMMENT ON COLUMN public.organizations.billing_email IS
  'Billing contact email for platform subscription invoices.';

CREATE TABLE IF NOT EXISTS public.organization_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT,
  card_brand TEXT,
  last4 TEXT NOT NULL,
  exp_month INTEGER,
  exp_year INTEGER,
  cardholder_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS organization_payment_methods_org_idx
  ON public.organization_payment_methods(organization_id, is_default DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.organization_billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
  description TEXT,
  period_start DATE,
  period_end DATE,
  paid_at TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_billing_invoices_org_idx
  ON public.organization_billing_invoices(organization_id, created_at DESC);

ALTER TABLE public.organization_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_manage_org_billing(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    LEFT JOIN public.organization_roles r
      ON r.id = om.role_id
     AND r.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_organization_id
      AND (
        om.role IN ('super_admin', 'owner')
        OR lower(trim(coalesce(r.name, ''))) = 'super admin'
      )
  );
$$;

CREATE POLICY organization_payment_methods_select ON public.organization_payment_methods
  FOR SELECT TO authenticated
  USING (public.user_can_manage_org_billing(organization_id));

CREATE POLICY organization_payment_methods_insert ON public.organization_payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_manage_org_billing(organization_id));

CREATE POLICY organization_payment_methods_update ON public.organization_payment_methods
  FOR UPDATE TO authenticated
  USING (public.user_can_manage_org_billing(organization_id));

CREATE POLICY organization_payment_methods_delete ON public.organization_payment_methods
  FOR DELETE TO authenticated
  USING (public.user_can_manage_org_billing(organization_id));

CREATE POLICY organization_billing_invoices_select ON public.organization_billing_invoices
  FOR SELECT TO authenticated
  USING (public.user_can_manage_org_billing(organization_id));
