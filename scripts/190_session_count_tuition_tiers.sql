-- =============================================================================
-- 190_session_count_tuition_tiers.sql
-- Fee plan metadata.session_count_tiers: map week/session count → tuition amount.
-- Example:
--   metadata = {
--     "session_count_tiers": {
--       "1": 135, "2": 270, "3": 360, "4": 450,
--       "5": 585, "6": 720, "7": 810, "8": 900
--     }
--   }
-- full_program uses the offering's active session count (or all weeks).
-- selected_sessions / single_session use the selected session count.
-- Also restores sibling-only discount application (non-sibling rules skipped).
--
-- Run after 184. Replaces compute_program_registration_quote_base and keeps the
-- 184 employee-benefit wrapper on compute_program_registration_quote.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.quote_lookup_session_count_tier(
  p_plan_metadata jsonb,
  p_session_count integer,
  p_fallback numeric
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_plan_metadata IS NULL THEN p_fallback
    WHEN COALESCE(p_plan_metadata->'session_count_tiers', '{}'::jsonb) = '{}'::jsonb
      THEN p_fallback
    WHEN (p_plan_metadata->'session_count_tiers') ? p_session_count::text
      THEN COALESCE(
        NULLIF(p_plan_metadata->'session_count_tiers'->>p_session_count::text, '')::numeric,
        p_fallback
      )
    ELSE p_fallback
  END;
$$;

REVOKE ALL ON FUNCTION public.quote_lookup_session_count_tier(jsonb, integer, numeric)
  FROM PUBLIC, anon, authenticated;

-- Ensure base exists (184 renames quote → base the first time).
DO $$
BEGIN
  IF to_regprocedure(
    'public.compute_program_registration_quote_base(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'
  ) IS NULL
  AND to_regprocedure(
    'public.compute_program_registration_quote(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'
  ) IS NOT NULL THEN
    ALTER FUNCTION public.compute_program_registration_quote(
      uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb
    ) RENAME TO compute_program_registration_quote_base;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.compute_program_registration_quote_base(
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
  v_tier_count integer := 0;
  v_offering_month_count integer := 1;
  v_participant_month_count integer := 1;
  v_monthly_unit numeric := 0;
  v_registration_fee numeric := 0;
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
  v_i integer;
  v_due_date date;
  v_today date := CURRENT_DATE;
  v_balance_due_date date;
  v_last_installment numeric;
  v_monthly_schedule jsonb;
  v_has_tiers boolean := false;
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

  IF to_regprocedure(
    'public.resolve_registration_session_ids(uuid,uuid,uuid,text,uuid[])'
  ) IS NOT NULL THEN
    v_resolved_session_ids := public.resolve_registration_session_ids(
      p_organization_id,
      p_program_id,
      p_offering_id,
      v_option.option_type,
      p_session_ids
    );
    v_session_count := COALESCE(array_length(v_resolved_session_ids, 1), 0);
  ELSE
    v_session_count := COALESCE(array_length(p_session_ids, 1), 0);
  END IF;

  v_plan := public.resolve_fee_plan_for_option(
    p_organization_id, p_offering_id, v_option.fee_plan_id
  );

  v_has_tiers := COALESCE(v_plan.metadata->'session_count_tiers', '{}'::jsonb) <> '{}'::jsonb;

  v_offering_month_count := public.count_offering_billing_months(
    COALESCE(v_offering.start_date, v_today),
    COALESCE(v_offering.end_date, v_today)
  );

  v_participant_month_count := public.count_offering_billing_months_from_date(
    COALESCE(v_offering.start_date, v_today),
    COALESCE(v_offering.end_date, v_today),
    v_today
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
      IF NOT v_addon_enabled THEN CONTINUE; END IF;
    END IF;

    v_qty := CASE v_comp.quantity_mode
      WHEN 'session_count' THEN GREATEST(v_session_count, 0)
      WHEN 'month_count' THEN
        CASE
          WHEN v_plan.plan_type = 'monthly' AND v_comp.pricing_model = 'per_month'
            THEN v_participant_month_count
          ELSE v_offering_month_count
        END
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

    IF v_comp.pricing_model = 'percent_of_tuition' THEN CONTINUE; END IF;

    -- Week-count tuition tiers (camp packages): one line = tier amount for N weeks.
    IF v_has_tiers
       AND v_comp.component_type = 'tuition'
       AND v_comp.pricing_model IN ('flat', 'per_session') THEN
      v_tier_count := v_session_count;
      IF v_option.option_type = 'full_program' THEN
        SELECT COUNT(*)::integer INTO v_tier_count
        FROM public.program_sessions s
        WHERE s.organization_id = p_organization_id
          AND s.program_id = p_program_id
          AND s.offering_id = p_offering_id
          AND s.status = 'active';
      END IF;
      v_line_amount := public.quote_lookup_session_count_tier(
        v_plan.metadata,
        GREATEST(v_tier_count, 0),
        v_comp.amount
      );
      v_unit_amount := v_line_amount;
      v_qty := 1;
    ELSIF v_comp.pricing_model = 'per_session'
       AND v_comp.session_price_source = 'session_table'
       AND v_comp.component_type IN ('tuition', 'custom')
       AND v_comp.quantity_mode IN ('session_count', 'fixed') THEN
      IF v_session_count > 0 AND v_resolved_session_ids IS NOT NULL THEN
        SELECT COALESCE(SUM(s.price), 0) INTO v_line_amount
        FROM public.program_sessions s
        WHERE s.organization_id = p_organization_id
          AND s.program_id = p_program_id
          AND s.status = 'active'
          AND s.id = ANY(v_resolved_session_ids);
      END IF;
    ELSIF v_comp.addon_key = 'lunch_option' AND v_lunch_option_id IS NOT NULL THEN
      SELECT lo.name, lo.price INTO v_lunch
      FROM public.program_lunch_options lo
      WHERE lo.id = v_lunch_option_id
        AND lo.organization_id = p_organization_id
        AND lo.is_active = true;
      IF NOT FOUND THEN RAISE EXCEPTION 'quote:invalid-lunch'; END IF;
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

    IF v_comp.component_type = 'registration_fee' THEN
      v_registration_fee := v_registration_fee + v_line_amount;
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
      AND (
        c.applies_to_option_types IS NULL
        OR v_option.option_type = ANY(c.applies_to_option_types)
      )
    ORDER BY c.sort_order, c.created_at
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
    SELECT *
    FROM public.program_offering_discount_rules dr
    WHERE dr.organization_id = p_organization_id
      AND dr.offering_id = p_offering_id
      AND dr.is_active = true
      AND (dr.fee_plan_id IS NULL OR dr.fee_plan_id = v_plan.id)
    ORDER BY dr.priority_rank, dr.created_at
  LOOP
    IF v_rule.rule_type = 'sibling' THEN
      IF p_registrant_contact_id IS NULL THEN CONTINUE; END IF;
      IF NOT public.quote_registrant_has_sibling_enrollment(
        p_organization_id, p_program_id, p_registrant_contact_id, p_participant_contact_id
      ) THEN CONTINUE; END IF;
    ELSE
      -- Only sibling discounts are applied by the quote engine today.
      CONTINUE;
    END IF;

    v_exclude_types := ARRAY(
      SELECT jsonb_array_elements_text(
        COALESCE(v_rule.conditions->'exclude_component_types', '[]'::jsonb)
      )
    );

    SELECT COALESCE(SUM((item->>'amount')::numeric), 0) INTO v_eligible_amount
    FROM jsonb_array_elements(v_line_items) AS item
    WHERE (
      CARDINALITY(v_exclude_types) = 0
      OR NOT (item->>'component_type' = ANY(v_exclude_types))
    );

    IF v_eligible_amount <= 0 THEN CONTINUE; END IF;

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
    v_monthly_schedule := public.build_monthly_quote_schedule(
      p_organization_id,
      p_offering_id,
      v_monthly_unit,
      v_registration_fee,
      v_recurring_subtotal,
      v_total,
      v_plan.payment_due_day,
      v_today
    );
    v_scheduled := COALESCE(v_monthly_schedule->'scheduled', '[]'::jsonb);
    v_due_today := COALESCE((v_monthly_schedule->>'due_today')::numeric, v_total);
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
    'offering_id', p_offering_id,
    'resolved_session_ids', COALESCE(to_jsonb(v_resolved_session_ids), '[]'::jsonb),
    'line_items', v_line_items,
    'subtotal', ROUND(v_subtotal, 2),
    'discounts', v_discounts,
    'discount_total', ROUND(v_discount_total, 2),
    'total', v_total,
    'due_today', ROUND(v_due_today, 2),
    'scheduled_payments', v_scheduled,
    'billing_month_count', v_participant_month_count,
    'offering_billing_month_count', v_offering_month_count
  );
END;
$$;

-- Keep 184 wrapper (employee benefit) on the public quote name.
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote jsonb;
BEGIN
  v_quote := public.compute_program_registration_quote_base(
    p_organization_id,
    p_program_id,
    p_offering_id,
    p_registration_option_id,
    p_registrant_contact_id,
    p_participant_contact_id,
    p_session_ids,
    p_addons
  );

  IF to_regprocedure(
    'public.apply_employee_benefit_discount_to_quote(uuid,uuid,uuid,jsonb)'
  ) IS NOT NULL THEN
    v_quote := public.apply_employee_benefit_discount_to_quote(
      p_organization_id,
      p_registrant_contact_id,
      p_participant_contact_id,
      v_quote
    );
  END IF;

  RETURN v_quote;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_program_registration_quote_base(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.compute_program_registration_quote(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb
) FROM PUBLIC, anon, authenticated;

SELECT
  to_regprocedure(
    'public.quote_lookup_session_count_tier(jsonb,integer,numeric)'
  ) IS NOT NULL AS tier_helper_exists,
  to_regprocedure(
    'public.compute_program_registration_quote_base(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'
  ) IS NOT NULL AS quote_base_exists;
