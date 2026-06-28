-- Contact profile payment methods: cards on file for a contact (not recurring-plan specific).
-- Run after 137_customer_role_merge.sql

CREATE TABLE IF NOT EXISTS public.contact_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS contact_payment_methods_contact_idx
  ON public.contact_payment_methods(organization_id, contact_id, is_default DESC, created_at DESC);

COMMENT ON TABLE public.contact_payment_methods IS
  'Credit/debit cards stored on a contact profile. Full card numbers are never stored in Manaratee.';

ALTER TABLE public.contact_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org contact payment methods" ON public.contact_payment_methods;
CREATE POLICY "Staff view org contact payment methods"
  ON public.contact_payment_methods FOR SELECT
  USING (public.auth_user_can_view_contacts(organization_id));

DROP POLICY IF EXISTS "Staff insert org contact payment methods" ON public.contact_payment_methods;
CREATE POLICY "Staff insert org contact payment methods"
  ON public.contact_payment_methods FOR INSERT
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff update org contact payment methods" ON public.contact_payment_methods;
CREATE POLICY "Staff update org contact payment methods"
  ON public.contact_payment_methods FOR UPDATE
  USING (public.auth_user_can_manage_contacts(organization_id))
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff delete org contact payment methods" ON public.contact_payment_methods;
CREATE POLICY "Staff delete org contact payment methods"
  ON public.contact_payment_methods FOR DELETE
  USING (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Customers view own contact payment methods" ON public.contact_payment_methods;
CREATE POLICY "Customers view own contact payment methods"
  ON public.contact_payment_methods FOR SELECT
  USING (contact_id IN (SELECT public.auth_user_contact_ids()));

DROP POLICY IF EXISTS "Customers insert own contact payment methods" ON public.contact_payment_methods;
CREATE POLICY "Customers insert own contact payment methods"
  ON public.contact_payment_methods FOR INSERT
  WITH CHECK (contact_id IN (SELECT public.auth_user_contact_ids()));

DROP POLICY IF EXISTS "Customers update own contact payment methods" ON public.contact_payment_methods;
CREATE POLICY "Customers update own contact payment methods"
  ON public.contact_payment_methods FOR UPDATE
  USING (contact_id IN (SELECT public.auth_user_contact_ids()))
  WITH CHECK (contact_id IN (SELECT public.auth_user_contact_ids()));

DROP POLICY IF EXISTS "Customers delete own contact payment methods" ON public.contact_payment_methods;
CREATE POLICY "Customers delete own contact payment methods"
  ON public.contact_payment_methods FOR DELETE
  USING (contact_id IN (SELECT public.auth_user_contact_ids()));
