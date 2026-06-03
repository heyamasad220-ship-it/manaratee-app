-- Phase 2B: Program charge ledger foundation (no Stripe / no payment processor)
-- Run after 019b_lock_quote_engine_and_verify.sql
--
-- Creates charge header, lines, schedule, checkout session, payment allocations,
-- org payment settings, and enrollment payment fields.
-- Phase 3 will wire Stripe checkout to program_checkouts + allocations.

-- ---------------------------------------------------------------------------
-- 0) Preconditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure(
    'public.compute_program_registration_quote(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION '020: compute_program_registration_quote missing — run 019/019b first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Organization program payment settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_payment_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  require_payment_at_registration BOOLEAN NOT NULL DEFAULT true,
  unpaid_registration_policy TEXT NOT NULL DEFAULT 'expire' CHECK (
    unpaid_registration_policy IN ('expire', 'keep_pending_payment')
  ),
  hold_capacity_on_pending_payment BOOLEAN NOT NULL DEFAULT true,
  checkout_expiry_minutes INTEGER NOT NULL DEFAULT 30 CHECK (checkout_expiry_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.program_payment_settings IS
  'Org-level rules for pay-at-registration, checkout expiry, and unpaid enrollment handling.';

-- ---------------------------------------------------------------------------
-- 2) Checkout session (multi-registration capable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payer_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  registrant_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_today NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_required BOOLEAN NOT NULL DEFAULT false,
  checkout_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    checkout_status IN (
      'draft', 'open', 'processing', 'paid', 'failed', 'expired', 'cancelled'
    )
  ),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_checkouts_org_status_idx
  ON public.program_checkouts(organization_id, checkout_status, created_at DESC);

CREATE INDEX IF NOT EXISTS program_checkouts_expires_idx
  ON public.program_checkouts(organization_id, expires_at)
  WHERE checkout_status IN ('draft', 'open', 'processing');

-- ---------------------------------------------------------------------------
-- 3) Charge header
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  checkout_id UUID REFERENCES public.program_checkouts(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.program_enrollments(id) ON DELETE SET NULL,
  waitlist_id UUID REFERENCES public.program_waitlist(id) ON DELETE SET NULL,
  charge_type TEXT NOT NULL DEFAULT 'registration' CHECK (
    charge_type IN ('registration', 'addon', 'adjustment', 'fee')
  ),
  source_type TEXT NOT NULL DEFAULT 'program_registration' CHECK (
    source_type IN ('program_registration', 'manual', 'addon', 'adjustment')
  ),
  source_id UUID,
  payer_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  registrant_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  participant_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  offering_id UUID REFERENCES public.program_offerings(id) ON DELETE SET NULL,
  registration_option_id UUID REFERENCES public.program_registration_options(id) ON DELETE SET NULL,
  fee_plan_id UUID REFERENCES public.program_offering_fee_plans(id) ON DELETE SET NULL,
  plan_type TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_today NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_required BOOLEAN NOT NULL DEFAULT false,
  charge_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    charge_status IN (
      'draft', 'pending_payment', 'partially_paid', 'paid', 'void', 'expired', 'written_off'
    )
  ),
  checkout_status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    checkout_status IN (
      'not_started', 'pending', 'processing', 'paid', 'failed', 'expired'
    )
  ),
  quote_snapshot JSONB NOT NULL DEFAULT '{}',
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_charges_org_enrollment_idx
  ON public.program_charges(organization_id, enrollment_id);

CREATE INDEX IF NOT EXISTS program_charges_org_checkout_idx
  ON public.program_charges(organization_id, checkout_id);

CREATE INDEX IF NOT EXISTS program_charges_org_status_idx
  ON public.program_charges(organization_id, charge_status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS program_charges_registration_unique_idx
  ON public.program_charges(organization_id, enrollment_id)
  WHERE enrollment_id IS NOT NULL AND charge_type = 'registration';

-- ---------------------------------------------------------------------------
-- 4) Charge lines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_charge_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES public.program_charges(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL,
  label TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_charge_lines_charge_idx
  ON public.program_charge_lines(organization_id, charge_id, sort_order);

-- ---------------------------------------------------------------------------
-- 5) Charge schedule (future installments / monthly / balance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_charge_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES public.program_charges(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL DEFAULT 'installment' CHECK (
    schedule_type IN ('deposit_balance', 'monthly', 'installment', 'custom')
  ),
  label TEXT NOT NULL,
  due_date DATE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'due', 'paid', 'void', 'past_due')
  ),
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_charge_schedule_charge_idx
  ON public.program_charge_schedule(organization_id, charge_id, sequence_number);

-- ---------------------------------------------------------------------------
-- 6) Payment allocations (Phase 3 — one payment → many charges)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id UUID,
  checkout_id UUID REFERENCES public.program_checkouts(id) ON DELETE SET NULL,
  charge_id UUID NOT NULL REFERENCES public.program_charges(id) ON DELETE CASCADE,
  charge_schedule_id UUID REFERENCES public.program_charge_schedule(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  allocation_type TEXT NOT NULL DEFAULT 'due_today' CHECK (
    allocation_type IN ('due_today', 'schedule', 'refund', 'adjustment')
  ),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_payment_allocations_charge_idx
  ON public.program_payment_allocations(organization_id, charge_id);

CREATE INDEX IF NOT EXISTS program_payment_allocations_checkout_idx
  ON public.program_payment_allocations(organization_id, checkout_id);

-- ---------------------------------------------------------------------------
-- 7) Extend program_enrollments for payment gate
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_enrollments
  ADD COLUMN IF NOT EXISTS charge_id UUID REFERENCES public.program_charges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capacity_hold_type TEXT NOT NULL DEFAULT 'none' CHECK (
    capacity_hold_type IN ('none', 'soft', 'firm')
  ),
  ADD COLUMN IF NOT EXISTS checkout_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS program_enrollments_charge_idx
  ON public.program_enrollments(organization_id, charge_id);

ALTER TABLE public.program_enrollments
  DROP CONSTRAINT IF EXISTS program_enrollments_status_check;

ALTER TABLE public.program_enrollments
  ADD CONSTRAINT program_enrollments_status_check
  CHECK (
    status IS NULL OR status IN (
      'pending_payment',
      'pending',
      'enrolled',
      'active',
      'completed',
      'cancelled',
      'withdrawn',
      'transferred',
      'expired'
    )
  );

-- ---------------------------------------------------------------------------
-- 8) Status helpers (payment-aware)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enrollment_status_counts_toward_capacity(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(COALESCE(p_status, '')) IN (
    'pending', 'pending_payment', 'enrolled', 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.enrollment_status_blocks_duplicate(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(COALESCE(p_status, '')) IN (
    'pending_payment', 'pending', 'enrolled', 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_allowed_enrollment_transition(
  p_from_status text,
  p_to_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_from_status, ''))
    WHEN 'pending_payment' THEN lower(p_to_status) IN ('enrolled', 'cancelled', 'expired')
    WHEN 'pending' THEN lower(p_to_status) IN ('enrolled', 'cancelled')
    WHEN 'enrolled' THEN lower(p_to_status) IN ('active', 'cancelled')
    WHEN 'active' THEN lower(p_to_status) IN ('completed', 'cancelled')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.quote_due_today_from_snapshot(p_quote jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((p_quote->>'due_today')::numeric, 0);
$$;

CREATE OR REPLACE FUNCTION public.resolve_registration_payment_required(
  p_organization_id uuid,
  p_due_today numeric
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
BEGIN
  SELECT *
  INTO v_settings
  FROM public.program_payment_settings s
  WHERE s.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN COALESCE(p_due_today, 0) > 0;
  END IF;

  IF v_settings.require_payment_at_registration IS NOT true THEN
    RETURN false;
  END IF;

  RETURN COALESCE(p_due_today, 0) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_initial_enrollment_status(
  p_organization_id uuid,
  p_due_today numeric
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.resolve_registration_payment_required(p_organization_id, p_due_today) THEN
    RETURN 'pending_payment';
  END IF;

  RETURN 'pending';
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) Build charge ledger from quote snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_program_charge_from_quote(
  p_organization_id uuid,
  p_quote jsonb,
  p_enrollment_id uuid DEFAULT NULL,
  p_program_id uuid DEFAULT NULL,
  p_offering_id uuid DEFAULT NULL,
  p_registration_option_id uuid DEFAULT NULL,
  p_payer_contact_id uuid DEFAULT NULL,
  p_registrant_contact_id uuid DEFAULT NULL,
  p_participant_contact_id uuid DEFAULT NULL,
  p_checkout_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge_id uuid;
  v_due_today numeric;
  v_subtotal numeric;
  v_discount_total numeric;
  v_total numeric;
  v_payment_required boolean;
  v_currency text;
  v_plan_type text;
  v_fee_plan_id uuid;
  v_line jsonb;
  v_discount jsonb;
  v_payment jsonb;
  v_line_idx integer := 0;
  v_schedule_idx integer := 0;
BEGIN
  IF p_quote IS NULL OR COALESCE(p_quote->>'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'charge:invalid-quote';
  END IF;

  v_currency := COALESCE(NULLIF(btrim(p_quote->>'currency'), ''), 'USD');
  v_plan_type := NULLIF(btrim(p_quote->>'plan_type'), '');
  v_fee_plan_id := NULLIF(p_quote->>'fee_plan_id', '')::uuid;
  v_subtotal := COALESCE((p_quote->>'subtotal')::numeric, 0);
  v_discount_total := COALESCE((p_quote->>'discount_total')::numeric, 0);
  v_total := COALESCE((p_quote->>'total')::numeric, 0);
  v_due_today := public.quote_due_today_from_snapshot(p_quote);
  v_payment_required := public.resolve_registration_payment_required(
    p_organization_id,
    v_due_today
  );

  INSERT INTO public.program_charges (
    organization_id,
    checkout_id,
    enrollment_id,
    charge_type,
    source_type,
    source_id,
    payer_contact_id,
    registrant_contact_id,
    participant_contact_id,
    program_id,
    offering_id,
    registration_option_id,
    fee_plan_id,
    plan_type,
    currency,
    subtotal,
    discount_total,
    total,
    due_today,
    payment_required,
    charge_status,
    checkout_status,
    quote_snapshot,
    due_at
  )
  VALUES (
    p_organization_id,
    p_checkout_id,
    p_enrollment_id,
    'registration',
    'program_registration',
    p_enrollment_id,
    p_payer_contact_id,
    p_registrant_contact_id,
    p_participant_contact_id,
    p_program_id,
    p_offering_id,
    p_registration_option_id,
    v_fee_plan_id,
    v_plan_type,
    v_currency,
    v_subtotal,
    v_discount_total,
    v_total,
    v_due_today,
    v_payment_required,
    CASE
      WHEN v_payment_required THEN 'pending_payment'
      WHEN v_due_today <= 0 THEN 'paid'
      ELSE 'pending_payment'
    END,
    CASE
      WHEN p_checkout_id IS NULL THEN 'not_started'
      ELSE 'pending'
    END,
    p_quote,
    CASE WHEN v_due_today > 0 THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_charge_id;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_quote->'line_items', '[]'::jsonb))
  LOOP
    INSERT INTO public.program_charge_lines (
      organization_id,
      charge_id,
      line_type,
      label,
      quantity,
      unit_amount,
      amount,
      sort_order
    )
    VALUES (
      p_organization_id,
      v_charge_id,
      COALESCE(NULLIF(v_line->>'component_type', ''), 'custom'),
      COALESCE(NULLIF(v_line->>'label', ''), 'Line item'),
      COALESCE((v_line->>'quantity')::numeric, 1),
      COALESCE((v_line->>'unit_amount')::numeric, 0),
      COALESCE((v_line->>'amount')::numeric, 0),
      v_line_idx
    );
    v_line_idx := v_line_idx + 1;
  END LOOP;

  FOR v_discount IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_quote->'discounts', '[]'::jsonb))
  LOOP
    INSERT INTO public.program_charge_lines (
      organization_id,
      charge_id,
      line_type,
      label,
      quantity,
      unit_amount,
      amount,
      sort_order,
      metadata
    )
    VALUES (
      p_organization_id,
      v_charge_id,
      COALESCE(NULLIF(v_discount->>'rule_type', ''), 'discount'),
      COALESCE(NULLIF(v_discount->>'label', ''), 'Discount'),
      1,
      -ABS(COALESCE((v_discount->>'amount')::numeric, 0)),
      -ABS(COALESCE((v_discount->>'amount')::numeric, 0)),
      v_line_idx,
      jsonb_build_object('is_discount', true)
    );
    v_line_idx := v_line_idx + 1;
  END LOOP;

  FOR v_payment IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_quote->'scheduled_payments', '[]'::jsonb))
  LOOP
    INSERT INTO public.program_charge_schedule (
      organization_id,
      charge_id,
      schedule_type,
      label,
      due_date,
      amount,
      sequence_number,
      status
    )
    VALUES (
      p_organization_id,
      v_charge_id,
      CASE
        WHEN v_plan_type = 'deposit_balance' THEN 'deposit_balance'
        WHEN v_plan_type = 'monthly' THEN 'monthly'
        WHEN v_plan_type = 'installments' THEN 'installment'
        ELSE 'custom'
      END,
      COALESCE(NULLIF(v_payment->>'label', ''), 'Scheduled payment'),
      NULLIF(v_payment->>'due_date', '')::date,
      COALESCE((v_payment->>'amount')::numeric, 0),
      v_schedule_idx,
      'scheduled'
    );
    v_schedule_idx := v_schedule_idx + 1;
  END LOOP;

  IF p_enrollment_id IS NOT NULL THEN
    UPDATE public.program_enrollments e
    SET
      charge_id = v_charge_id,
      payment_required = v_payment_required,
      quote_snapshot = COALESCE(e.quote_snapshot, p_quote)
    WHERE e.id = p_enrollment_id
      AND e.organization_id = p_organization_id;
  END IF;

  RETURN v_charge_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10) Bundle charges into a checkout session (multi-registration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_checkout_for_charges(
  p_organization_id uuid,
  p_charge_ids uuid[],
  p_payer_contact_id uuid DEFAULT NULL,
  p_registrant_contact_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkout_id uuid;
  v_settings record;
  v_totals record;
  v_expires_at timestamptz;
BEGIN
  IF p_charge_ids IS NULL OR array_length(p_charge_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'checkout:no-charges';
  END IF;

  SELECT *
  INTO v_settings
  FROM public.program_payment_settings s
  WHERE s.organization_id = p_organization_id;

  v_expires_at := NOW() + make_interval(
    mins => COALESCE(v_settings.checkout_expiry_minutes, 30)
  );

  SELECT
    COALESCE(SUM(c.subtotal), 0) AS subtotal,
    COALESCE(SUM(c.discount_total), 0) AS discount_total,
    COALESCE(SUM(c.total), 0) AS total,
    COALESCE(SUM(c.due_today), 0) AS due_today,
    BOOL_OR(c.payment_required) AS payment_required,
    MIN(c.currency) AS currency
  INTO v_totals
  FROM public.program_charges c
  WHERE c.organization_id = p_organization_id
    AND c.id = ANY(p_charge_ids);

  INSERT INTO public.program_checkouts (
    organization_id,
    payer_contact_id,
    registrant_contact_id,
    currency,
    subtotal,
    discount_total,
    total,
    due_today,
    payment_required,
    checkout_status,
    expires_at
  )
  VALUES (
    p_organization_id,
    p_payer_contact_id,
    p_registrant_contact_id,
    COALESCE(v_totals.currency, 'USD'),
    v_totals.subtotal,
    v_totals.discount_total,
    v_totals.total,
    v_totals.due_today,
    COALESCE(v_totals.payment_required, false),
    CASE
      WHEN COALESCE(v_totals.payment_required, false) THEN 'open'
      ELSE 'paid'
    END,
    v_expires_at
  )
  RETURNING id INTO v_checkout_id;

  UPDATE public.program_charges c
  SET
    checkout_id = v_checkout_id,
    checkout_status = CASE
      WHEN c.payment_required THEN 'pending'
      ELSE 'paid'
    END,
    expires_at = v_expires_at,
    updated_at = NOW()
  WHERE c.organization_id = p_organization_id
    AND c.id = ANY(p_charge_ids);

  UPDATE public.program_enrollments e
  SET checkout_expires_at = v_expires_at
  FROM public.program_charges c
  WHERE c.enrollment_id = e.id
    AND c.checkout_id = v_checkout_id
    AND e.organization_id = p_organization_id;

  RETURN v_checkout_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 11) Phase 3 placeholder — mark checkout paid (no Stripe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_checkout_payment_placeholder(
  p_organization_id uuid,
  p_checkout_id uuid,
  p_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkout record;
  v_paid_amount numeric;
BEGIN
  SELECT *
  INTO v_checkout
  FROM public.program_checkouts c
  WHERE c.id = p_checkout_id
    AND c.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkout:not-found';
  END IF;

  IF v_checkout.checkout_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'checkout_id', p_checkout_id, 'already_paid', true);
  END IF;

  v_paid_amount := COALESCE(p_amount, v_checkout.due_today, 0);

  UPDATE public.program_checkouts
  SET
    checkout_status = 'paid',
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_checkout_id;

  UPDATE public.program_charges
  SET
    charge_status = 'paid',
    checkout_status = 'paid',
    amount_paid = due_today,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE checkout_id = p_checkout_id
    AND organization_id = p_organization_id;

  UPDATE public.program_enrollments e
  SET
    status = 'enrolled',
    payment_status = 'paid',
    amount_paid = c.due_today,
    capacity_hold_type = 'firm'
  FROM public.program_charges c
  WHERE c.enrollment_id = e.id
    AND c.checkout_id = p_checkout_id
    AND e.organization_id = p_organization_id
    AND e.status = 'pending_payment';

  INSERT INTO public.program_payment_allocations (
    organization_id,
    checkout_id,
    charge_id,
    amount,
    allocation_type
  )
  SELECT
    c.organization_id,
    p_checkout_id,
    c.id,
    c.due_today,
    'due_today'
  FROM public.program_charges c
  WHERE c.checkout_id = p_checkout_id
    AND c.organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'ok', true,
    'checkout_id', p_checkout_id,
    'amount', v_paid_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_checkout_payment_placeholder(uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_checkout_payment_placeholder(uuid, uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.apply_checkout_payment_placeholder(uuid, uuid, numeric) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 12) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_charge_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_charge_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage program payment settings" ON public.program_payment_settings;
CREATE POLICY "Org members manage program payment settings"
  ON public.program_payment_settings FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members manage program checkouts" ON public.program_checkouts;
CREATE POLICY "Org members manage program checkouts"
  ON public.program_checkouts FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers view own program checkouts" ON public.program_checkouts;
CREATE POLICY "Customers view own program checkouts"
  ON public.program_checkouts FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid())
    AND (
      payer_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
      OR registrant_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members manage program charges" ON public.program_charges;
CREATE POLICY "Org members manage program charges"
  ON public.program_charges FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers view own program charges" ON public.program_charges;
CREATE POLICY "Customers view own program charges"
  ON public.program_charges FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid())
    AND (
      payer_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
      OR registrant_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
      OR participant_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Org members manage program charge lines" ON public.program_charge_lines;
CREATE POLICY "Org members manage program charge lines"
  ON public.program_charge_lines FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers view own program charge lines" ON public.program_charge_lines;
CREATE POLICY "Customers view own program charge lines"
  ON public.program_charge_lines FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid())
    AND charge_id IN (
      SELECT c.id FROM public.program_charges c
      WHERE c.organization_id = program_charge_lines.organization_id
        AND (
          c.payer_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
          OR c.registrant_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Org members manage program charge schedule" ON public.program_charge_schedule;
CREATE POLICY "Org members manage program charge schedule"
  ON public.program_charge_schedule FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers view own program charge schedule" ON public.program_charge_schedule;
CREATE POLICY "Customers view own program charge schedule"
  ON public.program_charge_schedule FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid())
    AND charge_id IN (
      SELECT c.id FROM public.program_charges c
      WHERE c.organization_id = program_charge_schedule.organization_id
        AND (
          c.payer_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
          OR c.registrant_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Org members manage program payment allocations" ON public.program_payment_allocations;
CREATE POLICY "Org members manage program payment allocations"
  ON public.program_payment_allocations FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 13) Grants (internal builders; Phase 3 checkout RPCs will wrap these)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.build_program_charge_from_quote(
  uuid, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_checkout_for_charges(
  uuid, uuid[], uuid, uuid
) FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.program_payment_settings TO authenticated;
GRANT SELECT ON public.program_checkouts TO authenticated;
GRANT SELECT ON public.program_charges TO authenticated;
GRANT SELECT ON public.program_charge_lines TO authenticated;
GRANT SELECT ON public.program_charge_schedule TO authenticated;

-- ---------------------------------------------------------------------------
-- 14) Verification
-- ---------------------------------------------------------------------------
SELECT
  to_regclass('public.program_charges') IS NOT NULL AS program_charges_exists,
  to_regclass('public.program_charge_lines') IS NOT NULL AS program_charge_lines_exists,
  to_regclass('public.program_charge_schedule') IS NOT NULL AS program_charge_schedule_exists,
  to_regclass('public.program_checkouts') IS NOT NULL AS program_checkouts_exists,
  to_regclass('public.program_payment_allocations') IS NOT NULL AS program_payment_allocations_exists,
  to_regclass('public.program_payment_settings') IS NOT NULL AS program_payment_settings_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'program_enrollments'
      AND column_name = 'charge_id'
  ) AS enrollment_charge_id_exists,
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'program_enrollments_status_check'
      AND pg_get_constraintdef(oid) LIKE '%pending_payment%'
  ) AS pending_payment_status_supported;
