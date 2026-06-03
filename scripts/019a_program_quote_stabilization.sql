-- Phase 2A Stabilization (019A)
-- Run after 019_program_fee_plans_quote_engine.sql
--
-- Fixes: secure compute RPC, unified session resolution, per-session addons,
-- monthly schedule, loud fee-plan errors, quote_snapshot on enrollments.

-- ---------------------------------------------------------------------------
-- 1) quote_snapshot on enrollments
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_enrollments
  ADD COLUMN IF NOT EXISTS quote_snapshot JSONB;

-- ---------------------------------------------------------------------------
-- 2) Unified session resolution (authoritative for quote + registration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_registration_session_ids(
  p_organization_id uuid,
  p_program_id uuid,
  p_offering_id uuid,
  p_option_type text,
  p_selected_session_ids uuid[]
)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering_sessions uuid[];
  v_fallback_sessions uuid[];
  v_valid_count integer;
BEGIN
  IF p_option_type = 'full_program' THEN
    SELECT COALESCE(
      array_agg(s.id ORDER BY s.sort_order NULLS LAST, s.start_date, s.id),
      '{}'::uuid[]
    )
    INTO v_offering_sessions
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active'
      AND s.offering_id = p_offering_id;

    IF COALESCE(array_length(v_offering_sessions, 1), 0) > 0 THEN
      RETURN v_offering_sessions;
    END IF;

    SELECT COALESCE(
      array_agg(s.id ORDER BY s.sort_order NULLS LAST, s.start_date, s.id),
      '{}'::uuid[]
    )
    INTO v_fallback_sessions
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active';

    RETURN COALESCE(v_fallback_sessions, '{}'::uuid[]);
  END IF;

  IF p_option_type = 'selected_sessions' THEN
    IF p_selected_session_ids IS NULL
       OR array_length(p_selected_session_ids, 1) IS NULL
       OR array_length(p_selected_session_ids, 1) = 0 THEN
      RAISE EXCEPTION 'quote:invalid-session';
    END IF;

    SELECT COUNT(*)
    INTO v_valid_count
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active'
      AND s.id = ANY(p_selected_session_ids);

    IF v_valid_count IS DISTINCT FROM array_length(p_selected_session_ids, 1) THEN
      RAISE EXCEPTION 'quote:invalid-session';
    END IF;

    RETURN p_selected_session_ids;
  END IF;

  IF p_option_type IN ('single_session', 'drop_in') THEN
    IF p_selected_session_ids IS NULL
       OR array_length(p_selected_session_ids, 1) IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'quote:invalid-session';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.program_sessions s
      WHERE s.organization_id = p_organization_id
        AND s.program_id = p_program_id
        AND s.status = 'active'
        AND s.id = p_selected_session_ids[1]
    ) THEN
      RAISE EXCEPTION 'quote:invalid-session';
    END IF;

    RETURN p_selected_session_ids;
  END IF;

  RETURN COALESCE(p_selected_session_ids, '{}'::uuid[]);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_registration_session_ids(uuid, uuid, uuid, text, uuid[]) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3) Fail loudly on invalid fee_plan_id (no silent fallback)
-- ---------------------------------------------------------------------------
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

    IF NOT FOUND THEN
      RAISE EXCEPTION 'quote:invalid-fee-plan';
    END IF;

    RETURN v_plan;
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

-- ---------------------------------------------------------------------------
-- 4) compute_program_registration_quote (internal — resolves sessions, monthly fix)
-- ---------------------------------------------------------------------------
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
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_option record;
  v_offering record;
  v_plan public.program_offering_fee_plans;
  v_comp record;
  v_lunch record;
  v_resolved_session_ids uuid[];
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
  v_monthly_unit numeric := 0;
  v_recurring_subtotal numeric := 0;
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
  v_scheduled_total numeric;
  v_i integer;
  v_due_date date;
  v_today date := CURRENT_DATE;
  v_balance_due_date date;
  v_last_installment numeric;
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

  v_resolved_session_ids := public.resolve_registration_session_ids(
    p_organization_id,
    p_program_id,
    p_offering_id,
    v_option.option_type,
    p_session_ids
  );

  v_session_count := COALESCE(array_length(v_resolved_session_ids, 1), 0);

  v_plan := public.resolve_fee_plan_for_option(
    p_organization_id, p_offering_id, v_option.fee_plan_id
  );

  v_month_count := public.count_offering_billing_months(
    COALESCE(v_offering.start_date, v_today),
    COALESCE(v_offering.end_date, v_today)
  );

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
      IF v_session_count > 0 THEN
        SELECT COALESCE(SUM(s.price), 0)
        INTO v_line_amount
        FROM public.program_sessions s
        WHERE s.organization_id = p_organization_id
          AND s.program_id = p_program_id
          AND s.status = 'active'
          AND s.id = ANY(v_resolved_session_ids);
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

    IF v_comp.pricing_model = 'per_month' AND v_comp.component_type = 'tuition' THEN
      v_monthly_unit := v_monthly_unit + v_comp.amount;
      v_recurring_subtotal := v_recurring_subtotal + v_line_amount;
    END IF;

    IF v_comp.component_type = 'tuition' THEN
      v_tuition_base := v_tuition_base + v_line_amount;
    END IF;

    IF v_line_amount <> 0 OR v_plan.plan_type = 'free' THEN
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
    END IF;
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
    ELSE
      CONTINUE;
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
    IF v_month_count > 1 AND v_monthly_unit > 0 THEN
      v_scheduled_total := ROUND(v_monthly_unit * (v_month_count - 1), 2);
      IF v_subtotal > 0 AND v_discount_total > 0 THEN
        v_scheduled_total := ROUND(v_scheduled_total * (v_total / v_subtotal), 2);
      END IF;
      v_due_today := GREATEST(ROUND(v_total - v_scheduled_total, 2), 0);
      v_installment_amount := CASE
        WHEN v_month_count > 1 THEN ROUND(v_scheduled_total / (v_month_count - 1), 2)
        ELSE 0
      END;
      v_last_installment := v_scheduled_total - (v_installment_amount * GREATEST(v_month_count - 2, 0));

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
            'amount', CASE WHEN v_i = v_month_count THEN v_last_installment ELSE v_installment_amount END
          )
        );
      END LOOP;
    ELSE
      v_due_today := v_total;
    END IF;
  ELSIF v_plan.plan_type = 'installments' THEN
    IF COALESCE(v_plan.installment_count, 0) > 1 THEN
      v_installment_amount := ROUND(v_total / v_plan.installment_count, 2);
      v_due_today := v_installment_amount;
      v_last_installment := v_total - (v_installment_amount * (v_plan.installment_count - 1));
      v_due_date := v_today;
      FOR v_i IN 2..v_plan.installment_count LOOP
        v_scheduled := v_scheduled || jsonb_build_array(
          jsonb_build_object(
            'label', 'Installment ' || v_i,
            'due_date', (v_due_date + ((v_i - 1) || ' months')::interval)::date,
            'amount', CASE WHEN v_i = v_plan.installment_count THEN v_last_installment ELSE v_installment_amount END
          )
        );
      END LOOP;
    ELSE
      v_due_today := v_total;
    END IF;
  ELSE
    v_due_today := v_total;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'currency', v_plan.currency,
    'fee_plan_id', v_plan.id,
    'plan_type', v_plan.plan_type,
    'registration_option_id', p_registration_option_id,
    'resolved_session_ids', COALESCE(to_jsonb(v_resolved_session_ids), '[]'::jsonb),
    'line_items', v_line_items,
    'subtotal', ROUND(v_subtotal, 2),
    'discounts', v_discounts,
    'discount_total', ROUND(v_discount_total, 2),
    'total', v_total,
    'due_today', ROUND(v_due_today, 2),
    'scheduled_payments', v_scheduled
  );
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'quote:%' THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'quote:pricing-error';
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) quote_program_registration (public API — unchanged signature)
-- ---------------------------------------------------------------------------
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
-- 6) Backfill addon components on per_session fee plans
-- ---------------------------------------------------------------------------
INSERT INTO public.program_offering_fee_plan_components (
  organization_id, fee_plan_id, component_type, label, amount,
  pricing_model, quantity_mode, addon_key, sort_order
)
SELECT fp.organization_id, fp.id, 'extended_care', 'Before Care', 25, 'per_session', 'addon_selected', 'before_care', 20
FROM public.program_offering_fee_plans fp
WHERE fp.plan_type = 'per_session'
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
WHERE fp.plan_type = 'per_session'
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
WHERE fp.plan_type = 'per_session'
  AND NOT EXISTS (
    SELECT 1 FROM public.program_offering_fee_plan_components c
    WHERE c.fee_plan_id = fp.id AND c.addon_key = 'lunch_option'
  );

-- ---------------------------------------------------------------------------
-- 7) register_for_program — resolved sessions + quote_snapshot
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
  v_next_position integer;
  v_enrollment_open boolean;
  v_program_name text;
  v_addons jsonb;
  v_quote jsonb;
  v_total_amount numeric;
  v_resolved_session_ids uuid[];
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

  BEGIN
    v_resolved_session_ids := public.resolve_registration_session_ids(
      p_organization_id,
      p_program_id,
      v_offering.id,
      v_option.option_type,
      p_session_ids
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'quote:invalid-session%' THEN
        RAISE EXCEPTION 'register_for_program:invalid-session';
      END IF;
      RAISE;
  END;

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
      CASE WHEN COALESCE(array_length(v_resolved_session_ids, 1), 0) > 0
        THEN v_resolved_session_ids::text[] ELSE NULL END,
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

  SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
  INTO v_resolved_session_ids
  FROM jsonb_array_elements_text(COALESCE(v_quote->'resolved_session_ids', '[]'::jsonb)) AS value;

  INSERT INTO public.program_enrollments (
    organization_id, program_id, offering_id, department_id, registration_option_id,
    participant_contact_id, registrant_contact_id, payer_contact_id,
    participant_type, registrant_type, child_person_id, child_name, child_age,
    parent_name, parent_email, parent_phone, session_name, weeks,
    enrollment_date, status, payment_status, amount_paid, total_amount,
    before_care, after_care, lunch_type, notes, quote_snapshot
  )
  VALUES (
    p_organization_id, p_program_id, v_offering.id, v_program.department_id, p_registration_option_id,
    v_participant_contact_id, v_registrant.id, v_registrant.id,
    v_participant_type, v_registrant_type, v_child_person_id, v_child_name, v_child_age,
    COALESCE(NULLIF(btrim(p_parent_name), ''), v_registrant.full_name),
    COALESCE(NULLIF(btrim(p_parent_email), ''), v_registrant.email),
    COALESCE(NULLIF(btrim(p_parent_phone), ''), v_registrant.phone),
    NULLIF(btrim(p_session_name), ''),
    CASE WHEN COALESCE(array_length(v_resolved_session_ids, 1), 0) > 0
      THEN v_resolved_session_ids::text[] ELSE NULL END,
    v_today, 'pending', 'pending', 0, v_total_amount,
    COALESCE(p_before_care, false), COALESCE(p_after_care, false),
    NULLIF(btrim(p_lunch_type), ''), NULLIF(btrim(p_notes), ''),
    v_quote
  )
  RETURNING id INTO v_enrollment_id;

  PERFORM public.grant_enrollment_session_access(
    p_organization_id, v_enrollment_id, v_resolved_session_ids
  );

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

-- ---------------------------------------------------------------------------
-- 8) Grants — compute is internal-only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.compute_program_registration_quote(uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_program_registration_quote(uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.quote_program_registration(uuid, uuid, uuid, uuid, uuid, uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_program(
  uuid, uuid, uuid, uuid, uuid[], text, text, text, text, text, boolean, boolean, text, uuid, numeric, text
) TO authenticated;
