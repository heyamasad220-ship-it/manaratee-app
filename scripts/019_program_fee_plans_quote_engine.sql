-- Phase 2A: Offering-scoped fee plans + read-only quote engine
-- Run after 018_program_lifecycle_foundation.sql

-- ---------------------------------------------------------------------------
-- 1) Fee plan tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_offering_fee_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK (
    plan_type IN ('free', 'one_time', 'deposit_balance', 'monthly', 'installments', 'per_session')
  ),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_due_day SMALLINT CHECK (payment_due_day IS NULL OR payment_due_day BETWEEN 1 AND 28),
  installment_count INTEGER CHECK (installment_count IS NULL OR installment_count > 0),
  effective_from DATE,
  effective_until DATE,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_offering_fee_plans_offering_idx
  ON public.program_offering_fee_plans(organization_id, offering_id);

CREATE UNIQUE INDEX IF NOT EXISTS program_offering_fee_plans_default_idx
  ON public.program_offering_fee_plans(organization_id, offering_id)
  WHERE is_default = true;

CREATE TABLE IF NOT EXISTS public.program_offering_fee_plan_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fee_plan_id UUID NOT NULL REFERENCES public.program_offering_fee_plans(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK (
    component_type IN ('tuition', 'registration_fee', 'materials', 'lunch', 'extended_care', 'custom')
  ),
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_model TEXT NOT NULL DEFAULT 'flat' CHECK (
    pricing_model IN ('flat', 'per_session', 'per_month', 'percent_of_tuition')
  ),
  quantity_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (
    quantity_mode IN ('fixed', 'session_count', 'month_count', 'addon_selected')
  ),
  quantity_value NUMERIC(12,4) NOT NULL DEFAULT 1,
  addon_key TEXT,
  session_price_source TEXT NOT NULL DEFAULT 'session_table' CHECK (
    session_price_source IN ('component', 'session_table')
  ),
  applies_to_option_types TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_offering_fee_plan_components_plan_idx
  ON public.program_offering_fee_plan_components(organization_id, fee_plan_id, sort_order);

CREATE TABLE IF NOT EXISTS public.program_offering_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  fee_plan_id UUID REFERENCES public.program_offering_fee_plans(id) ON DELETE SET NULL,
  rule_type TEXT NOT NULL CHECK (
    rule_type IN ('sibling', 'multi_session', 'early_bird', 'custom')
  ),
  label TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_amount')),
  amount NUMERIC(12,2) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority_rank INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_offering_discount_rules_offering_idx
  ON public.program_offering_discount_rules(organization_id, offering_id, priority_rank);

ALTER TABLE public.program_registration_options
  ADD COLUMN IF NOT EXISTS fee_plan_id UUID
    REFERENCES public.program_offering_fee_plans(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_offering_fee_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_offering_fee_plan_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_offering_discount_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage offering fee plans" ON public.program_offering_fee_plans;
CREATE POLICY "Org members manage offering fee plans"
  ON public.program_offering_fee_plans FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers view active offering fee plans" ON public.program_offering_fee_plans;
CREATE POLICY "Customers view active offering fee plans"
  ON public.program_offering_fee_plans FOR SELECT
  USING (
    is_active = true
    AND organization_id IN (SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members manage fee plan components" ON public.program_offering_fee_plan_components;
CREATE POLICY "Org members manage fee plan components"
  ON public.program_offering_fee_plan_components FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers view active fee plan components" ON public.program_offering_fee_plan_components;
CREATE POLICY "Customers view active fee plan components"
  ON public.program_offering_fee_plan_components FOR SELECT
  USING (
    is_active = true
    AND organization_id IN (SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members manage offering discount rules" ON public.program_offering_discount_rules;
CREATE POLICY "Org members manage offering discount rules"
  ON public.program_offering_discount_rules FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers view active offering discount rules" ON public.program_offering_discount_rules;
CREATE POLICY "Customers view active offering discount rules"
  ON public.program_offering_discount_rules FOR SELECT
  USING (
    is_active = true
    AND organization_id IN (SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3) Quote helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_offering_billing_months(
  p_start_date date,
  p_end_date date
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_start date;
  v_end date;
  v_count integer := 0;
BEGIN
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RETURN 1;
  END IF;

  v_start := date_trunc('month', p_start_date)::date;
  v_end := date_trunc('month', p_end_date)::date;

  WHILE v_start <= v_end LOOP
    v_count := v_count + 1;
    v_start := (v_start + INTERVAL '1 month')::date;
  END LOOP;

  RETURN GREATEST(v_count, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_fee_plan_for_option(
  p_organization_id uuid,
  p_offering_id uuid,
  p_fee_plan_id uuid
)
RETURNS public.program_offering_fee_plans
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.program_offering_fee_plans;
BEGIN
  IF p_fee_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.program_offering_fee_plans fp
    WHERE fp.id = p_fee_plan_id
      AND fp.organization_id = p_organization_id
      AND fp.offering_id = p_offering_id
      AND fp.is_active = true;

    IF FOUND THEN
      RETURN v_plan;
    END IF;
  END IF;

  SELECT * INTO v_plan
  FROM public.program_offering_fee_plans fp
  WHERE fp.organization_id = p_organization_id
    AND fp.offering_id = p_offering_id
    AND fp.is_default = true
    AND fp.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote:no-fee-plan';
  END IF;

  RETURN v_plan;
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_registrant_has_sibling_enrollment(
  p_organization_id uuid,
  p_program_id uuid,
  p_registrant_contact_id uuid,
  p_participant_contact_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.program_id = p_program_id
      AND e.registrant_contact_id = p_registrant_contact_id
      AND e.participant_contact_id IS DISTINCT FROM p_participant_contact_id
      AND public.enrollment_status_blocks_duplicate(e.status)
  );
$$;

CREATE OR REPLACE FUNCTION public.compute_program_registration_quote(
  p_organization_id uuid,
  p_program_id uuid,
  p_offering_id uuid,
  p_registration_option_id uuid,
  p_registrant_contact_id uuid,
  p_participant_contact_id uuid,
  p_session_ids uuid[],
  p_addons jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_option record;
  v_offering record;
  v_plan public.program_offering_fee_plans;
  v_comp record;
  v_session record;
  v_lunch record;
  v_line_items jsonb := '[]'::jsonb;
  v_discounts jsonb := '[]'::jsonb;
  v_scheduled jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_discount_total numeric := 0;
  v_total numeric := 0;
  v_due_today numeric := 0;
  v_tuition_base numeric := 0;
  v_session_count integer := 0;
  v_month_count integer := 1;
  v_qty numeric;
  v_unit_amount numeric;
  v_line_amount numeric;
  v_before_care boolean;
  v_after_care boolean;
  v_lunch_option_id uuid;
  v_addon_enabled boolean;
  v_rule record;
  v_discount_amount numeric;
  v_eligible_amount numeric;
  v_exclude_types text[];
  v_balance numeric;
  v_installment_amount numeric;
  v_i integer;
  v_due_date date;
  v_today date := CURRENT_DATE;
  v_balance_due_date date;
BEGIN
  v_before_care := COALESCE((p_addons->>'before_care')::boolean, false);
  v_after_care := COALESCE((p_addons->>'after_care')::boolean, false);
  v_lunch_option_id := NULLIF(p_addons->>'lunch_option_id', '')::uuid;

  SELECT ro.* INTO v_option
  FROM public.program_registration_options ro
  WHERE ro.id = p_registration_option_id
    AND ro.organization_id = p_organization_id
    AND ro.program_id = p_program_id
    AND ro.offering_id = p_offering_id
    AND ro.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote:invalid-option';
  END IF;

  SELECT o.* INTO v_offering
  FROM public.program_offerings o
  WHERE o.id = p_offering_id
    AND o.organization_id = p_organization_id
    AND o.program_id = p_program_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote:invalid-offering';
  END IF;

  v_plan := public.resolve_fee_plan_for_option(
    p_organization_id, p_offering_id, v_option.fee_plan_id
  );

  v_month_count := public.count_offering_billing_months(
    COALESCE(v_offering.start_date, v_today),
    COALESCE(v_offering.end_date, v_today)
  );

  IF v_option.option_type = 'full_program' THEN
    SELECT COUNT(*)::integer INTO v_session_count
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active'
      AND (s.offering_id IS NULL OR s.offering_id = p_offering_id);
  ELSIF v_option.option_type = 'selected_sessions' THEN
    v_session_count := COALESCE(array_length(p_session_ids, 1), 0);
  ELSE
    v_session_count := 1;
  END IF;

  FOR v_comp IN
    SELECT *
    FROM public.program_offering_fee_plan_components c
    WHERE c.fee_plan_id = v_plan.id
      AND c.organization_id = p_organization_id
      AND c.is_active = true
      AND (
        c.applies_to_option_types IS NULL
        OR v_option.option_type = ANY(c.applies_to_option_types)
      )
    ORDER BY c.sort_order, c.created_at
  LOOP
    IF v_comp.quantity_mode = 'addon_selected' THEN
      v_addon_enabled := false;
      IF v_comp.addon_key = 'before_care' THEN
        v_addon_enabled := v_before_care;
      ELSIF v_comp.addon_key = 'after_care' THEN
        v_addon_enabled := v_after_care;
      ELSIF v_comp.addon_key = 'lunch_option' THEN
        v_addon_enabled := v_lunch_option_id IS NOT NULL;
      END IF;

      IF NOT v_addon_enabled THEN
        CONTINUE;
      END IF;
    END IF;

    v_qty := CASE v_comp.quantity_mode
      WHEN 'session_count' THEN GREATEST(v_session_count, 0)
      WHEN 'month_count' THEN v_month_count
      WHEN 'addon_selected' THEN
        CASE
          WHEN v_comp.addon_key IN ('before_care', 'after_care', 'lunch_option')
            THEN GREATEST(v_session_count, 1)
          ELSE v_comp.quantity_value
        END
      ELSE v_comp.quantity_value
    END;

    v_unit_amount := v_comp.amount;
    v_line_amount := 0;

    IF v_comp.pricing_model = 'percent_of_tuition' THEN
      CONTINUE;
    END IF;

    IF v_comp.pricing_model = 'per_session'
       AND v_comp.session_price_source = 'session_table'
       AND v_comp.component_type IN ('tuition', 'custom')
       AND v_comp.quantity_mode IN ('session_count', 'fixed') THEN
      IF p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0 THEN
        SELECT COALESCE(SUM(s.price), 0)
        INTO v_line_amount
        FROM public.program_sessions s
        WHERE s.organization_id = p_organization_id
          AND s.program_id = p_program_id
          AND s.status = 'active'
          AND s.id = ANY(p_session_ids);
      ELSE
        v_line_amount := 0;
      END IF;
    ELSIF v_comp.addon_key = 'lunch_option' AND v_lunch_option_id IS NOT NULL THEN
      SELECT lo.name, lo.price
      INTO v_lunch
      FROM public.program_lunch_options lo
      WHERE lo.id = v_lunch_option_id
        AND lo.organization_id = p_organization_id
        AND lo.is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'quote:invalid-lunch';
      END IF;

      v_unit_amount := COALESCE(v_lunch.price, 0);
      v_line_amount := ROUND(v_unit_amount * v_qty, 2);
    ELSE
      v_line_amount := ROUND(
        CASE v_comp.pricing_model
          WHEN 'per_session' THEN v_comp.amount * v_qty
          WHEN 'per_month' THEN v_comp.amount * v_qty
          ELSE v_comp.amount * v_qty
        END,
        2
      );
    END IF;

    IF v_line_amount = 0 AND v_plan.plan_type <> 'free' THEN
      IF v_comp.component_type = 'tuition' AND v_plan.plan_type = 'free' THEN
        NULL;
      ELSIF v_comp.pricing_model = 'flat' AND v_comp.amount = 0 THEN
        NULL;
      END IF;
    END IF;

    IF v_comp.component_type = 'tuition' THEN
      v_tuition_base := v_tuition_base + v_line_amount;
    END IF;

    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object(
        'component_type', v_comp.component_type,
        'label', v_comp.label,
        'quantity', v_qty,
        'unit_amount', v_unit_amount,
        'amount', v_line_amount
      )
    );
    v_subtotal := v_subtotal + v_line_amount;
  END LOOP;

  FOR v_comp IN
    SELECT *
    FROM public.program_offering_fee_plan_components c
    WHERE c.fee_plan_id = v_plan.id
      AND c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.pricing_model = 'percent_of_tuition'
    ORDER BY c.sort_order
  LOOP
    v_line_amount := ROUND(v_tuition_base * (v_comp.amount / 100.0), 2);
    IF v_line_amount <> 0 THEN
      v_line_items := v_line_items || jsonb_build_array(
        jsonb_build_object(
          'component_type', v_comp.component_type,
          'label', v_comp.label,
          'quantity', 1,
          'unit_amount', v_line_amount,
          'amount', v_line_amount
        )
      );
      v_subtotal := v_subtotal + v_line_amount;
    END IF;
  END LOOP;

  FOR v_rule IN
    SELECT dr.*
    FROM public.program_offering_discount_rules dr
    WHERE dr.organization_id = p_organization_id
      AND dr.offering_id = p_offering_id
      AND dr.is_active = true
      AND (dr.fee_plan_id IS NULL OR dr.fee_plan_id = v_plan.id)
    ORDER BY dr.priority_rank, dr.created_at
  LOOP
    IF v_rule.rule_type = 'sibling' THEN
      IF p_registrant_contact_id IS NULL THEN
        CONTINUE;
      END IF;

      IF NOT public.quote_registrant_has_sibling_enrollment(
        p_organization_id,
        p_program_id,
        p_registrant_contact_id,
        p_participant_contact_id
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    v_exclude_types := ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(v_rule.conditions->'exclude_component_types', '[]'::jsonb)
      )
    );

    v_eligible_amount := 0;
    SELECT COALESCE(SUM((item->>'amount')::numeric), 0)
    INTO v_eligible_amount
    FROM jsonb_array_elements(v_line_items) AS item
    WHERE (
      CARDINALITY(v_exclude_types) = 0
      OR NOT (item->>'component_type' = ANY(v_exclude_types))
    );

    IF v_eligible_amount <= 0 THEN
      CONTINUE;
    END IF;

    v_discount_amount := CASE v_rule.discount_type
      WHEN 'percent' THEN ROUND(v_eligible_amount * (v_rule.amount / 100.0), 2)
      ELSE LEAST(v_rule.amount, v_eligible_amount)
    END;

    IF v_discount_amount > 0 THEN
      v_discounts := v_discounts || jsonb_build_array(
        jsonb_build_object(
          'rule_type', v_rule.rule_type,
          'label', v_rule.label,
          'amount', v_discount_amount
        )
      );
      v_discount_total := v_discount_total + v_discount_amount;
    END IF;
  END LOOP;

  v_total := GREATEST(ROUND(v_subtotal - v_discount_total, 2), 0);

  IF v_plan.plan_type = 'free' THEN
    v_due_today := 0;
  ELSIF v_plan.plan_type IN ('one_time', 'per_session') THEN
    v_due_today := v_total;
  ELSIF v_plan.plan_type = 'deposit_balance' THEN
    v_due_today := LEAST(GREATEST(v_plan.deposit_amount, 0), v_total);
    v_balance := GREATEST(v_total - v_due_today, 0);
    IF v_balance > 0 THEN
      v_balance_due_date := COALESCE(v_offering.start_date, v_today);
      v_scheduled := jsonb_build_array(
        jsonb_build_object(
          'label', 'Balance',
          'due_date', v_balance_due_date,
          'amount', v_balance
        )
      );
    END IF;
  ELSIF v_plan.plan_type = 'monthly' THEN
    v_due_today := CASE
      WHEN v_month_count > 0 THEN ROUND(v_total / v_month_count, 2)
      ELSE v_total
    END;
    v_due_date := v_today;
    IF v_plan.payment_due_day IS NOT NULL THEN
      v_due_date := make_date(
        EXTRACT(YEAR FROM v_today)::integer,
        EXTRACT(MONTH FROM v_today)::integer,
        LEAST(v_plan.payment_due_day, 28)
      );
      IF v_due_date < v_today THEN
        v_due_date := (v_due_date + INTERVAL '1 month')::date;
      END IF;
    END IF;

    FOR v_i IN 2..GREATEST(v_month_count, 1) LOOP
      v_scheduled := v_scheduled || jsonb_build_array(
        jsonb_build_object(
          'label', 'Monthly payment ' || v_i,
          'due_date', (v_due_date + ((v_i - 1) || ' months')::interval)::date,
          'amount', v_due_today
        )
      );
    END LOOP;
  ELSIF v_plan.plan_type = 'installments' THEN
    v_installment_amount := CASE
      WHEN COALESCE(v_plan.installment_count, 0) > 0
        THEN ROUND(v_total / v_plan.installment_count, 2)
      ELSE v_total
    END;
    v_due_today := v_installment_amount;
    v_due_date := v_today;
    FOR v_i IN 2..GREATEST(COALESCE(v_plan.installment_count, 1), 1) LOOP
      v_scheduled := v_scheduled || jsonb_build_array(
        jsonb_build_object(
          'label', 'Installment ' || v_i,
          'due_date', (v_due_date + ((v_i - 1) || ' months')::interval)::date,
          'amount', v_installment_amount
        )
      );
    END LOOP;
  ELSE
    v_due_today := v_total;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'currency', v_plan.currency,
    'fee_plan_id', v_plan.id,
    'plan_type', v_plan.plan_type,
    'line_items', v_line_items,
    'subtotal', ROUND(v_subtotal, 2),
    'discounts', v_discounts,
    'discount_total', ROUND(v_discount_total, 2),
    'total', v_total,
    'due_today', ROUND(v_due_today, 2),
    'scheduled_payments', v_scheduled
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_program_registration(
  p_organization_id uuid,
  p_program_id uuid,
  p_offering_id uuid,
  p_registration_option_id uuid,
  p_participant_contact_id uuid,
  p_session_ids uuid[],
  p_addons jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registrant record;
  v_program record;
  v_participant_contact_id uuid;
  v_registrant_contact_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'quote:unauthorized';
  END IF;

  IF NOT public.customer_has_org_access(p_organization_id)
     AND NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'quote:unauthorized';
  END IF;

  SELECT * INTO v_program
  FROM public.programs p
  WHERE p.id = p_program_id
    AND p.organization_id = p_organization_id
    AND p.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quote:invalid-program';
  END IF;

  SELECT * INTO v_registrant
  FROM public.get_customer_contact(p_organization_id);

  IF v_registrant.id IS NULL AND NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'quote:unauthorized';
  END IF;

  v_registrant_contact_id := v_registrant.id;

  IF COALESCE(v_program.program_type, 'youth') = 'adult' THEN
    v_participant_contact_id := COALESCE(p_participant_contact_id, v_registrant.id);
  ELSE
    v_participant_contact_id := p_participant_contact_id;

    IF v_participant_contact_id IS NULL AND public.is_org_staff(p_organization_id, auth.uid()) THEN
      v_participant_contact_id := NULL;
      v_registrant_contact_id := NULL;
    ELSIF v_participant_contact_id IS NULL THEN
      RAISE EXCEPTION 'quote:invalid-participant';
    ELSIF v_registrant.person_id IS NULL OR NOT public.is_registrant_family_participant(
      p_organization_id,
      v_registrant.person_id,
      v_participant_contact_id
    ) THEN
      RAISE EXCEPTION 'quote:invalid-participant';
    END IF;
  END IF;

  RETURN public.compute_program_registration_quote(
    p_organization_id,
    p_program_id,
    p_offering_id,
    p_registration_option_id,
    v_registrant_contact_id,
    v_participant_contact_id,
    p_session_ids,
    COALESCE(p_addons, '{}'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'quote:%' THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'quote:failed';
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Backfill fee plans from programs billing fields
-- ---------------------------------------------------------------------------
INSERT INTO public.program_offering_fee_plans (
  organization_id, program_id, offering_id, name, plan_type,
  is_default, is_active, deposit_amount, payment_due_day, installment_count
)
SELECT
  o.organization_id,
  o.program_id,
  o.id,
  COALESCE(NULLIF(btrim(p.name), ''), 'Program') || ' — Default Fee Plan',
  CASE COALESCE(p.billing_type, 'free')
    WHEN 'free' THEN 'free'
    WHEN 'one_time' THEN 'one_time'
    WHEN 'deposit_balance' THEN 'deposit_balance'
    WHEN 'monthly' THEN 'monthly'
    WHEN 'installments' THEN 'installments'
    ELSE 'one_time'
  END,
  true,
  true,
  COALESCE(p.deposit_amount, 0),
  p.payment_due_day,
  p.installment_count
FROM public.program_offerings o
JOIN public.programs p ON p.id = o.program_id AND p.organization_id = o.organization_id
WHERE o.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_fee_plans fp
    WHERE fp.offering_id = o.id AND fp.is_default = true
  );

INSERT INTO public.program_offering_fee_plan_components (
  organization_id, fee_plan_id, component_type, label, amount,
  pricing_model, quantity_mode, quantity_value, sort_order
)
SELECT
  fp.organization_id,
  fp.id,
  'tuition',
  CASE fp.plan_type
    WHEN 'monthly' THEN 'Monthly Tuition'
    ELSE 'Tuition'
  END,
  CASE fp.plan_type
    WHEN 'monthly' THEN COALESCE(p.monthly_amount, 0)
    ELSE COALESCE(p.tuition_amount, 0)
  END,
  CASE fp.plan_type
    WHEN 'monthly' THEN 'per_month'
    ELSE 'flat'
  END,
  CASE fp.plan_type
    WHEN 'monthly' THEN 'month_count'
    ELSE 'fixed'
  END,
  1,
  10
FROM public.program_offering_fee_plans fp
JOIN public.programs p ON p.id = fp.program_id AND p.organization_id = fp.organization_id
WHERE fp.is_default = true
  AND fp.plan_type <> 'free'
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_fee_plan_components c
    WHERE c.fee_plan_id = fp.id AND c.component_type = 'tuition'
  );

INSERT INTO public.program_offering_fee_plans (
  organization_id, program_id, offering_id, name, plan_type, is_default, is_active
)
SELECT
  o.organization_id,
  o.program_id,
  o.id,
  COALESCE(NULLIF(btrim(p.name), ''), 'Program') || ' — Per Session',
  'per_session',
  false,
  true
FROM public.program_offerings o
JOIN public.programs p ON p.id = o.program_id AND p.organization_id = o.organization_id
WHERE o.is_default = true
  AND (
    COALESCE(p.session_registration_enabled, false) = true
    OR EXISTS (
      SELECT 1 FROM public.program_registration_options ro
      WHERE ro.offering_id = o.id
        AND ro.option_type IN ('selected_sessions', 'single_session', 'drop_in')
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_fee_plans fp
    WHERE fp.offering_id = o.id AND fp.plan_type = 'per_session'
  );

INSERT INTO public.program_offering_fee_plan_components (
  organization_id, fee_plan_id, component_type, label, amount,
  pricing_model, quantity_mode, session_price_source,
  applies_to_option_types, sort_order
)
SELECT
  fp.organization_id,
  fp.id,
  'tuition',
  'Session Tuition',
  0,
  'per_session',
  'session_count',
  'session_table',
  ARRAY['selected_sessions', 'single_session', 'drop_in']::text[],
  10
FROM public.program_offering_fee_plans fp
WHERE fp.plan_type = 'per_session'
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_fee_plan_components c
    WHERE c.fee_plan_id = fp.id AND c.component_type = 'tuition'
  );

INSERT INTO public.program_offering_fee_plan_components (
  organization_id, fee_plan_id, component_type, label, amount,
  pricing_model, quantity_mode, addon_key, sort_order
)
SELECT fp.organization_id, fp.id, 'extended_care', 'Before Care', 25, 'per_session', 'addon_selected', 'before_care', 20
FROM public.program_offering_fee_plans fp
WHERE fp.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_fee_plan_components c
    WHERE c.fee_plan_id = fp.id AND c.addon_key = 'before_care'
  );

INSERT INTO public.program_offering_fee_plan_components (
  organization_id, fee_plan_id, component_type, label, amount,
  pricing_model, quantity_mode, addon_key, sort_order
)
SELECT fp.organization_id, fp.id, 'extended_care', 'After Care', 25, 'per_session', 'addon_selected', 'after_care', 30
FROM public.program_offering_fee_plans fp
WHERE fp.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_fee_plan_components c
    WHERE c.fee_plan_id = fp.id AND c.addon_key = 'after_care'
  );

INSERT INTO public.program_offering_fee_plan_components (
  organization_id, fee_plan_id, component_type, label, amount,
  pricing_model, quantity_mode, addon_key, sort_order
)
SELECT fp.organization_id, fp.id, 'lunch', 'Lunch', 0, 'per_session', 'addon_selected', 'lunch_option', 40
FROM public.program_offering_fee_plans fp
WHERE fp.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_fee_plan_components c
    WHERE c.fee_plan_id = fp.id AND c.addon_key = 'lunch_option'
  );

UPDATE public.program_registration_options ro
SET fee_plan_id = fp_default.id
FROM public.program_offering_fee_plans fp_default
WHERE ro.offering_id = fp_default.offering_id
  AND fp_default.is_default = true
  AND ro.option_type IN ('full_program')
  AND ro.fee_plan_id IS NULL;

UPDATE public.program_registration_options ro
SET fee_plan_id = fp_session.id
FROM public.program_offering_fee_plans fp_session
WHERE ro.offering_id = fp_session.offering_id
  AND fp_session.plan_type = 'per_session'
  AND ro.option_type IN ('selected_sessions', 'single_session', 'drop_in')
  AND ro.fee_plan_id IS NULL;

INSERT INTO public.program_offering_discount_rules (
  organization_id, offering_id, fee_plan_id, rule_type, label,
  discount_type, amount, conditions, is_active, priority_rank
)
SELECT
  o.organization_id,
  o.id,
  fp.id,
  'sibling',
  'Sibling Discount',
  'percent',
  10,
  '{"min_active_enrollments": 1, "exclude_component_types": ["registration_fee"]}'::jsonb,
  false,
  10
FROM public.program_offerings o
JOIN public.programs p ON p.id = o.program_id AND p.organization_id = o.organization_id
JOIN public.program_offering_fee_plans fp ON fp.offering_id = o.id AND fp.is_default = true
WHERE o.is_default = true
  AND COALESCE(p.program_type, 'youth') IN ('youth', 'family')
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_discount_rules dr
    WHERE dr.offering_id = o.id AND dr.rule_type = 'sibling'
  );

-- ---------------------------------------------------------------------------
-- 5) register_for_program — server-side quote for total_amount
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_for_program(
  p_organization_id uuid,
  p_program_id uuid,
  p_registration_option_id uuid,
  p_participant_contact_id uuid,
  p_session_ids uuid[],
  p_mode text,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_notes text,
  p_before_care boolean,
  p_after_care boolean,
  p_lunch_type text,
  p_lunch_option_id uuid,
  p_total_amount numeric,
  p_session_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_registrant record;
  v_program record;
  v_offering record;
  v_option record;
  v_participant record;
  v_person record;
  v_enrollment_id uuid;
  v_waitlist_id uuid;
  v_is_adult boolean;
  v_participant_contact_id uuid;
  v_child_person_id uuid;
  v_child_name text;
  v_child_age integer;
  v_participant_type text;
  v_registrant_type text;
  v_today date;
  v_valid_session_count integer;
  v_next_position integer;
  v_enrollment_open boolean;
  v_program_name text;
  v_addons jsonb;
  v_quote jsonb;
  v_total_amount numeric;
BEGIN
  v_user_id := auth.uid();
  v_today := CURRENT_DATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'register_for_program:unauthorized';
  END IF;

  IF NOT public.customer_has_org_access(p_organization_id) THEN
    RAISE EXCEPTION 'register_for_program:unauthorized';
  END IF;

  SELECT * INTO v_registrant
  FROM public.get_customer_contact(p_organization_id);

  IF v_registrant.id IS NULL THEN
    RAISE EXCEPTION 'register_for_program:unauthorized';
  END IF;

  SELECT *
  INTO v_program
  FROM public.programs p
  WHERE p.id = p_program_id
    AND p.organization_id = p_organization_id
    AND p.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_for_program:invalid-program';
  END IF;

  v_program_name := v_program.name;

  SELECT *
  INTO v_offering
  FROM public.program_offerings o
  WHERE o.organization_id = p_organization_id
    AND o.program_id = p_program_id
    AND o.is_default = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_for_program:invalid-offering';
  END IF;

  v_enrollment_open := true;
  IF COALESCE(v_offering.enrollment_open_date, v_program.enrollment_open_date) IS NOT NULL
     AND v_today < COALESCE(v_offering.enrollment_open_date, v_program.enrollment_open_date) THEN
    v_enrollment_open := false;
  END IF;
  IF COALESCE(v_offering.enrollment_close_date, v_program.enrollment_close_date) IS NOT NULL
     AND v_today > COALESCE(v_offering.enrollment_close_date, v_program.enrollment_close_date) THEN
    v_enrollment_open := false;
  END IF;

  IF NOT v_enrollment_open THEN
    RAISE EXCEPTION 'register_for_program:enrollment-closed';
  END IF;

  SELECT *
  INTO v_option
  FROM public.program_registration_options ro
  WHERE ro.id = p_registration_option_id
    AND ro.organization_id = p_organization_id
    AND ro.program_id = p_program_id
    AND ro.offering_id = v_offering.id
    AND ro.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_for_program:invalid-option';
  END IF;

  IF v_option.available_from IS NOT NULL AND v_today < v_option.available_from THEN
    RAISE EXCEPTION 'register_for_program:invalid-option';
  END IF;
  IF v_option.available_until IS NOT NULL AND v_today > v_option.available_until THEN
    RAISE EXCEPTION 'register_for_program:invalid-option';
  END IF;

  v_is_adult := COALESCE(v_program.program_type, 'youth') = 'adult';

  IF v_is_adult THEN
    v_participant_contact_id := v_registrant.id;
    v_participant_type := 'adult';
    v_registrant_type := 'adult_self';
  ELSE
    v_participant_type := CASE
      WHEN COALESCE(v_program.program_type, 'youth') = 'family' THEN 'family'
      ELSE 'youth'
    END;
    v_registrant_type := 'guardian';

    IF p_participant_contact_id IS NULL THEN
      RAISE EXCEPTION 'register_for_program:invalid-participant';
    END IF;

    v_participant_contact_id := p_participant_contact_id;

    IF v_registrant.person_id IS NULL THEN
      RAISE EXCEPTION 'register_for_program:invalid-participant';
    END IF;

    IF NOT public.is_registrant_family_participant(
      p_organization_id,
      v_registrant.person_id,
      v_participant_contact_id
    ) THEN
      RAISE EXCEPTION 'register_for_program:invalid-participant';
    END IF;
  END IF;

  SELECT c.id, c.person_id, c.full_name
  INTO v_participant
  FROM public.contacts c
  WHERE c.id = v_participant_contact_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_for_program:invalid-participant';
  END IF;

  v_child_person_id := v_participant.person_id;
  v_child_name := COALESCE(NULLIF(btrim(v_participant.full_name), ''), NULLIF(btrim(p_parent_name), ''), 'Participant');

  IF v_child_person_id IS NOT NULL THEN
    SELECT p.id, p.date_of_birth
    INTO v_person
    FROM public.people p
    WHERE p.id = v_child_person_id
      AND p.organization_id = p_organization_id;

    IF FOUND AND v_person.date_of_birth IS NOT NULL THEN
      v_child_age := EXTRACT(YEAR FROM age(v_today, v_person.date_of_birth))::integer;
    END IF;
  END IF;

  IF p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0 THEN
    SELECT COUNT(*)
    INTO v_valid_session_count
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active'
      AND s.id = ANY(p_session_ids);

    IF v_valid_session_count IS DISTINCT FROM array_length(p_session_ids, 1) THEN
      RAISE EXCEPTION 'register_for_program:invalid-session';
    END IF;
  END IF;

  IF v_option.option_type = 'selected_sessions'
     AND (p_session_ids IS NULL OR array_length(p_session_ids, 1) IS NULL OR array_length(p_session_ids, 1) = 0) THEN
    RAISE EXCEPTION 'register_for_program:invalid-session';
  END IF;

  IF v_option.option_type IN ('single_session', 'drop_in')
     AND (p_session_ids IS NULL OR array_length(p_session_ids, 1) IS DISTINCT FROM 1) THEN
    RAISE EXCEPTION 'register_for_program:invalid-session';
  END IF;

  IF lower(COALESCE(p_mode, 'enroll')) = 'waitlist' THEN
    IF v_child_person_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.program_waitlist w
      WHERE w.organization_id = p_organization_id
        AND w.program_id = p_program_id
        AND w.child_person_id = v_child_person_id
        AND lower(COALESCE(w.status, 'waiting')) IN ('waiting', 'offered')
    ) THEN
      RAISE EXCEPTION 'register_for_program:already-waitlisted';
    END IF;

    SELECT COALESCE(MAX(w.position), 0) + 1
    INTO v_next_position
    FROM public.program_waitlist w
    WHERE w.organization_id = p_organization_id
      AND w.program_id = p_program_id;

    INSERT INTO public.program_waitlist (
      organization_id, program_id, child_person_id, participant_contact_id,
      child_name, child_age, parent_name, parent_email, parent_phone,
      preferred_weeks, added_date, position, status, priority, notes
    )
    VALUES (
      p_organization_id, p_program_id, v_child_person_id, v_participant_contact_id,
      v_child_name, v_child_age,
      COALESCE(NULLIF(btrim(p_parent_name), ''), v_registrant.full_name),
      COALESCE(NULLIF(btrim(p_parent_email), ''), v_registrant.email),
      COALESCE(NULLIF(btrim(p_parent_phone), ''), v_registrant.phone),
      CASE WHEN p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0
        THEN p_session_ids::text[] ELSE NULL END,
      v_today, v_next_position, 'waiting', 'normal', NULLIF(btrim(p_notes), '')
    )
    RETURNING id INTO v_waitlist_id;

    UPDATE public.programs
    SET waitlist = COALESCE(waitlist, 0) + 1, updated_at = NOW()
    WHERE id = p_program_id AND organization_id = p_organization_id;

    PERFORM public.write_waitlist_status_history(
      p_organization_id, v_waitlist_id, NULL, 'waiting', NULL, v_user_id, 'customer', '{}'
    );
    PERFORM public.write_lifecycle_event(
      p_organization_id, 'join_waitlist', NULL, v_waitlist_id, v_user_id, 'customer',
      jsonb_build_object('program_id', p_program_id)
    );

    RETURN jsonb_build_object('ok', true, 'mode', 'waitlist', 'waitlist_id', v_waitlist_id);
  END IF;

  IF v_program.capacity > 0 AND COALESCE(v_program.enrolled, 0) >= v_program.capacity THEN
    RAISE EXCEPTION 'register_for_program:capacity-full';
  END IF;

  IF v_participant_contact_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id AND e.program_id = p_program_id
      AND e.participant_contact_id = v_participant_contact_id
      AND public.enrollment_status_blocks_duplicate(e.status)
  ) THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  END IF;

  IF v_child_person_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id AND e.program_id = p_program_id
      AND e.child_person_id = v_child_person_id
      AND public.enrollment_status_blocks_duplicate(e.status)
  ) THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  END IF;

  v_addons := jsonb_build_object(
    'before_care', COALESCE(p_before_care, false),
    'after_care', COALESCE(p_after_care, false),
    'lunch_option_id', p_lunch_option_id
  );

  v_quote := public.compute_program_registration_quote(
    p_organization_id, p_program_id, v_offering.id, p_registration_option_id,
    v_registrant.id, v_participant_contact_id, p_session_ids, v_addons
  );

  v_total_amount := COALESCE((v_quote->>'total')::numeric, 0);

  INSERT INTO public.program_enrollments (
    organization_id, program_id, offering_id, department_id, registration_option_id,
    participant_contact_id, registrant_contact_id, payer_contact_id,
    participant_type, registrant_type, child_person_id, child_name, child_age,
    parent_name, parent_email, parent_phone, session_name, weeks,
    enrollment_date, status, payment_status, amount_paid, total_amount,
    before_care, after_care, lunch_type, notes
  )
  VALUES (
    p_organization_id, p_program_id, v_offering.id, v_program.department_id, p_registration_option_id,
    v_participant_contact_id, v_registrant.id, v_registrant.id,
    v_participant_type, v_registrant_type, v_child_person_id, v_child_name, v_child_age,
    COALESCE(NULLIF(btrim(p_parent_name), ''), v_registrant.full_name),
    COALESCE(NULLIF(btrim(p_parent_email), ''), v_registrant.email),
    COALESCE(NULLIF(btrim(p_parent_phone), ''), v_registrant.phone),
    NULLIF(btrim(p_session_name), ''),
    CASE WHEN p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0
      THEN p_session_ids::text[] ELSE NULL END,
    v_today, 'pending', 'pending', 0, v_total_amount,
    COALESCE(p_before_care, false), COALESCE(p_after_care, false),
    NULLIF(btrim(p_lunch_type), ''), NULLIF(btrim(p_notes), '')
  )
  RETURNING id INTO v_enrollment_id;

  PERFORM public.grant_enrollment_session_access(p_organization_id, v_enrollment_id, p_session_ids);

  UPDATE public.programs
  SET enrolled = COALESCE(enrolled, 0) + 1, updated_at = NOW()
  WHERE id = p_program_id AND organization_id = p_organization_id;

  PERFORM public.write_enrollment_status_history(
    p_organization_id, v_enrollment_id, NULL, 'pending', NULL, v_user_id, 'customer', '{}'
  );
  PERFORM public.write_lifecycle_event(
    p_organization_id, 'register', v_enrollment_id, NULL, v_user_id, 'customer',
    jsonb_build_object(
      'program_id', p_program_id,
      'registration_option_id', p_registration_option_id,
      'quote', v_quote
    )
  );
  PERFORM public.write_enrollment_contact_activities(
    p_organization_id, v_enrollment_id, v_program_name, 'registered_program', 'pending'
  );

  RETURN jsonb_build_object(
    'ok', true, 'mode', 'enroll', 'enrollment_id', v_enrollment_id,
    'total_amount', v_total_amount, 'quote', v_quote
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'register_for_program:%' OR SQLERRM LIKE 'quote:%' THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'register_for_program:save-failed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_program_registration(uuid, uuid, uuid, uuid, uuid, uuid[], jsonb) TO authenticated;

-- compute_program_registration_quote: internal only (no GRANT to authenticated)
-- See 019a_program_quote_stabilization.sql

GRANT EXECUTE ON FUNCTION public.register_for_program(
  uuid, uuid, uuid, uuid, uuid[], text, text, text, text, text, boolean, boolean, text, uuid, numeric, text
) TO authenticated;