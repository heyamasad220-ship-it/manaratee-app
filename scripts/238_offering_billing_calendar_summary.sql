-- =============================================================================
-- 238_offering_billing_calendar_summary.sql
-- Billing calendar UX: due day from offering start date; skip months via
-- period_status; active-period counts for quotes/schedules.
-- Run after 021 (and 190 if session-count tiers are in use).
-- =============================================================================

-- Due day defaults to day-of-month from offering.start_date (capped at 28).
CREATE OR REPLACE FUNCTION public.sync_offering_billing_periods(
  p_organization_id uuid,
  p_offering_id uuid,
  p_default_tuition_amount numeric DEFAULT NULL,
  p_payment_due_day integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering record;
  v_cursor date;
  v_end date;
  v_seq integer := 0;
  v_period_end date;
  v_count integer := 0;
  v_due_day integer;
BEGIN
  SELECT o.* INTO v_offering
  FROM public.program_offerings o
  WHERE o.id = p_offering_id
    AND o.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing:invalid-offering';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'billing:unauthorized';
  END IF;

  IF v_offering.start_date IS NULL OR v_offering.end_date IS NULL THEN
    RETURN 0;
  END IF;

  v_due_day := COALESCE(
    p_payment_due_day,
    LEAST(EXTRACT(DAY FROM v_offering.start_date)::integer, 28)
  );

  v_cursor := public.offering_billing_period_start(v_offering.start_date);
  v_end := public.offering_billing_period_start(v_offering.end_date);

  WHILE v_cursor <= v_end LOOP
    v_seq := v_seq + 1;
    v_period_end := (v_cursor + INTERVAL '1 month' - INTERVAL '1 day')::date;

    INSERT INTO public.program_offering_billing_periods (
      organization_id,
      program_id,
      offering_id,
      period_key,
      period_label,
      period_start,
      period_end,
      due_date,
      sequence_number,
      default_tuition_amount
    )
    VALUES (
      p_organization_id,
      v_offering.program_id,
      p_offering_id,
      to_char(v_cursor, 'YYYY-MM'),
      public.format_billing_period_label(v_cursor),
      v_cursor,
      LEAST(v_period_end, v_offering.end_date),
      public.resolve_billing_period_due_date(v_cursor, v_due_day),
      v_seq,
      p_default_tuition_amount
    )
    ON CONFLICT (organization_id, offering_id, period_key)
    DO UPDATE SET
      period_label = EXCLUDED.period_label,
      period_start = EXCLUDED.period_start,
      period_end = EXCLUDED.period_end,
      due_date = EXCLUDED.due_date,
      sequence_number = EXCLUDED.sequence_number,
      default_tuition_amount = COALESCE(
        program_offering_billing_periods.default_tuition_amount,
        EXCLUDED.default_tuition_amount
      ),
      updated_at = NOW();
    -- period_status intentionally preserved (skipped months stay skipped)

    v_count := v_count + 1;
    v_cursor := (v_cursor + INTERVAL '1 month')::date;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_active_offering_billing_periods(
  p_organization_id uuid,
  p_offering_id uuid,
  p_from_date date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering record;
  v_from date;
  v_count integer := 0;
BEGIN
  SELECT o.* INTO v_offering
  FROM public.program_offerings o
  WHERE o.id = p_offering_id
    AND o.organization_id = p_organization_id;

  IF NOT FOUND OR v_offering.start_date IS NULL OR v_offering.end_date IS NULL THEN
    RETURN 1;
  END IF;

  v_from := public.offering_billing_period_start(
    GREATEST(
      COALESCE(p_from_date, v_offering.start_date),
      v_offering.start_date
    )
  );

  SELECT COUNT(*)::integer
  INTO v_count
  FROM public.program_offering_billing_periods bp
  WHERE bp.organization_id = p_organization_id
    AND bp.offering_id = p_offering_id
    AND bp.period_status = 'active'
    AND bp.period_start >= v_from;

  RETURN GREATEST(COALESCE(v_count, 0), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_offering_billing_month_counts(
  p_organization_id uuid,
  p_offering_id uuid,
  p_from_date date DEFAULT CURRENT_DATE,
  p_payment_due_day integer DEFAULT NULL,
  p_default_tuition_amount numeric DEFAULT NULL
)
RETURNS TABLE (
  offering_month_count integer,
  participant_month_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering record;
  v_due_day integer;
BEGIN
  SELECT o.* INTO v_offering
  FROM public.program_offerings o
  WHERE o.id = p_offering_id
    AND o.organization_id = p_organization_id;

  IF NOT FOUND THEN
    offering_month_count := 1;
    participant_month_count := 1;
    RETURN NEXT;
    RETURN;
  END IF;

  v_due_day := COALESCE(
    p_payment_due_day,
    CASE
      WHEN v_offering.start_date IS NOT NULL
        THEN LEAST(EXTRACT(DAY FROM v_offering.start_date)::integer, 28)
      ELSE NULL
    END
  );

  PERFORM public.sync_offering_billing_periods(
    p_organization_id,
    p_offering_id,
    p_default_tuition_amount,
    v_due_day
  );

  offering_month_count := public.count_active_offering_billing_periods(
    p_organization_id,
    p_offering_id,
    v_offering.start_date
  );
  participant_month_count := public.count_active_offering_billing_periods(
    p_organization_id,
    p_offering_id,
    COALESCE(p_from_date, CURRENT_DATE)
  );

  RETURN NEXT;
END;
$$;

-- Rebuild monthly quote schedule using active (non-skipped) periods only.
CREATE OR REPLACE FUNCTION public.build_monthly_quote_schedule(
  p_organization_id uuid,
  p_offering_id uuid,
  p_monthly_unit numeric,
  p_registration_fee numeric DEFAULT 0,
  p_recurring_total numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_payment_due_day integer DEFAULT NULL,
  p_enrollment_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering record;
  v_period record;
  v_scheduled jsonb := '[]'::jsonb;
  v_participant_month_count integer;
  v_installment_amount numeric;
  v_last_installment numeric;
  v_scheduled_total numeric;
  v_i integer := 0;
  v_due_today numeric;
  v_due_day integer;
BEGIN
  SELECT o.* INTO v_offering
  FROM public.program_offerings o
  WHERE o.id = p_offering_id
    AND o.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  v_due_day := COALESCE(
    p_payment_due_day,
    CASE
      WHEN v_offering.start_date IS NOT NULL
        THEN LEAST(EXTRACT(DAY FROM v_offering.start_date)::integer, 28)
      ELSE NULL
    END
  );

  PERFORM public.sync_offering_billing_periods(
    p_organization_id,
    p_offering_id,
    p_monthly_unit,
    v_due_day
  );

  v_participant_month_count := public.count_active_offering_billing_periods(
    p_organization_id,
    p_offering_id,
    p_enrollment_date
  );

  IF v_participant_month_count <= 0 OR p_monthly_unit <= 0 THEN
    v_due_today := p_total;
    RETURN jsonb_build_object(
      'scheduled', '[]'::jsonb,
      'due_today', v_due_today,
      'participant_month_count', v_participant_month_count
    );
  END IF;

  v_scheduled_total := ROUND(p_monthly_unit * GREATEST(v_participant_month_count - 1, 0), 2);
  IF p_recurring_total > 0 AND p_total < p_recurring_total THEN
    v_scheduled_total := ROUND(v_scheduled_total * (p_total / p_recurring_total), 2);
  END IF;

  v_due_today := GREATEST(ROUND(p_total - v_scheduled_total, 2), 0);
  v_installment_amount := CASE
    WHEN v_participant_month_count > 1 THEN ROUND(v_scheduled_total / (v_participant_month_count - 1), 2)
    ELSE 0
  END;
  v_last_installment := v_scheduled_total - (
    v_installment_amount * GREATEST(v_participant_month_count - 2, 0)
  );

  v_i := 0;
  FOR v_period IN
    SELECT bp.*
    FROM public.program_offering_billing_periods bp
    WHERE bp.organization_id = p_organization_id
      AND bp.offering_id = p_offering_id
      AND bp.period_status = 'active'
      AND bp.period_start >= public.offering_billing_period_start(
        GREATEST(
          p_enrollment_date,
          COALESCE(v_offering.start_date, p_enrollment_date)
        )
      )
    ORDER BY bp.sequence_number
  LOOP
    v_i := v_i + 1;
    IF v_i = 1 THEN
      CONTINUE;
    END IF;

    v_scheduled := v_scheduled || jsonb_build_array(
      jsonb_build_object(
        'label', v_period.period_label || ' tuition',
        'due_date', v_period.due_date,
        'amount', CASE
          WHEN v_i = v_participant_month_count THEN v_last_installment
          ELSE v_installment_amount
        END,
        'billing_period_id', v_period.id,
        'period_key', v_period.period_key
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'scheduled', v_scheduled,
    'due_today', v_due_today + COALESCE(p_registration_fee, 0),
    'participant_month_count', v_participant_month_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_offering_billing_period_statuses(
  p_organization_id uuid,
  p_offering_id uuid,
  p_period_ids uuid[],
  p_period_status text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_period_status NOT IN ('active', 'skipped') THEN
    RAISE EXCEPTION 'billing:invalid-period-status';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'billing:unauthorized';
  END IF;

  UPDATE public.program_offering_billing_periods bp
  SET
    period_status = p_period_status,
    updated_at = NOW()
  WHERE bp.organization_id = p_organization_id
    AND bp.offering_id = p_offering_id
    AND bp.id = ANY (p_period_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_active_offering_billing_periods(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_offering_billing_month_counts(uuid, uuid, date, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_offering_billing_period_statuses(uuid, uuid, uuid[], text) TO authenticated;
