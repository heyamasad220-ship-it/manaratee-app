-- Phase 2B: Admin charge line editing (registration fee management)
-- Run after 021_program_billing_schedule_and_overrides.sql
--
-- Staff can void, adjust, and add charge lines on a registration charge.
-- Recalculates charge header + enrollment totals. No payment processing.

-- ---------------------------------------------------------------------------
-- 0) Preconditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.program_charge_lines') IS NULL THEN
    RAISE EXCEPTION '022: program_charge_lines missing — run 020 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Recalculate charge header from active lines
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_program_charge_from_lines(
  p_organization_id uuid,
  p_charge_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge record;
  v_subtotal numeric := 0;
  v_discount_total numeric := 0;
  v_total numeric := 0;
  v_due_today numeric := 0;
  v_line record;
BEGIN
  SELECT * INTO v_charge
  FROM public.program_charges c
  WHERE c.id = p_charge_id
    AND c.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'charge:not-found';
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.program_charge_lines l
    WHERE l.charge_id = p_charge_id
      AND l.organization_id = p_organization_id
      AND COALESCE(l.metadata->>'status', 'active') <> 'voided'
    ORDER BY l.sort_order, l.created_at
  LOOP
    IF v_line.amount < 0 OR COALESCE((v_line.metadata->>'is_discount')::boolean, false) THEN
      v_discount_total := v_discount_total + ABS(v_line.amount);
    ELSE
      v_subtotal := v_subtotal + v_line.amount;
    END IF;
    v_total := v_total + v_line.amount;
  END LOOP;

  v_total := GREATEST(ROUND(v_total, 2), 0);
  v_subtotal := ROUND(v_subtotal, 2);
  v_discount_total := ROUND(v_discount_total, 2);

  v_due_today := CASE
    WHEN lower(COALESCE(v_charge.plan_type, '')) IN ('monthly', 'installments', 'deposit_balance')
      THEN GREATEST(ROUND(v_total - COALESCE(v_charge.amount_paid, 0), 2), 0)
    WHEN COALESCE(v_charge.amount_paid, 0) >= v_total THEN 0
    ELSE v_total
  END;

  UPDATE public.program_charges
  SET
    subtotal = v_subtotal,
    discount_total = v_discount_total,
    total = v_total,
    due_today = v_due_today,
    updated_at = NOW()
  WHERE id = p_charge_id;

  IF v_charge.enrollment_id IS NOT NULL THEN
    UPDATE public.program_enrollments e
    SET
      total_amount = v_total,
      updated_at = NOW()
    WHERE e.id = v_charge.enrollment_id
      AND e.organization_id = p_organization_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'charge_id', p_charge_id,
    'subtotal', v_subtotal,
    'discount_total', v_discount_total,
    'total', v_total,
    'due_today', v_due_today
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Ensure enrollment has a charge ledger (from quote snapshot)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_ensure_enrollment_charge(
  p_organization_id uuid,
  p_enrollment_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment record;
  v_charge_id uuid;
BEGIN
  IF NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'charge:unauthorized';
  END IF;

  SELECT * INTO v_enrollment
  FROM public.program_enrollments e
  WHERE e.id = p_enrollment_id
    AND e.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'charge:enrollment-not-found';
  END IF;

  IF v_enrollment.charge_id IS NOT NULL THEN
    RETURN v_enrollment.charge_id;
  END IF;

  IF v_enrollment.quote_snapshot IS NULL
     OR COALESCE(v_enrollment.quote_snapshot->>'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'charge:no-quote-snapshot';
  END IF;

  v_charge_id := public.build_program_charge_from_quote(
    p_organization_id,
    v_enrollment.quote_snapshot,
    v_enrollment.id,
    v_enrollment.program_id,
    v_enrollment.offering_id,
    v_enrollment.registration_option_id,
    v_enrollment.payer_contact_id,
    v_enrollment.registrant_contact_id,
    v_enrollment.participant_contact_id,
    NULL,
    COALESCE(v_enrollment.enrollment_date, CURRENT_DATE)
  );

  RETURN v_charge_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Void (cancel) a charge line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_program_charge_line(
  p_organization_id uuid,
  p_line_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
BEGIN
  IF NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'charge:unauthorized';
  END IF;

  SELECT * INTO v_line
  FROM public.program_charge_lines l
  WHERE l.id = p_line_id
    AND l.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'charge:line-not-found';
  END IF;

  IF COALESCE(v_line.metadata->>'status', 'active') = 'voided' THEN
    RETURN p_line_id;
  END IF;

  UPDATE public.program_charge_lines
  SET
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status', 'voided',
      'void_reason', COALESCE(p_reason, ''),
      'original_amount', amount,
      'original_unit_amount', unit_amount,
      'voided_at', NOW(),
      'voided_by', auth.uid()
    ),
    amount = 0,
    unit_amount = 0,
    quantity = 0
  WHERE id = p_line_id;

  PERFORM public.recalculate_program_charge_from_lines(
    p_organization_id,
    v_line.charge_id
  );

  RETURN p_line_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Adjust a charge line amount
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_program_charge_line(
  p_organization_id uuid,
  p_line_id uuid,
  p_unit_amount numeric DEFAULT NULL,
  p_quantity numeric DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line record;
  v_unit numeric;
  v_qty numeric;
  v_amount numeric;
BEGIN
  IF NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'charge:unauthorized';
  END IF;

  SELECT * INTO v_line
  FROM public.program_charge_lines l
  WHERE l.id = p_line_id
    AND l.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'charge:line-not-found';
  END IF;

  IF COALESCE(v_line.metadata->>'status', 'active') = 'voided' THEN
    RAISE EXCEPTION 'charge:line-voided';
  END IF;

  v_unit := COALESCE(p_unit_amount, v_line.unit_amount);
  v_qty := COALESCE(p_quantity, v_line.quantity);
  v_amount := COALESCE(
    p_amount,
    ROUND(v_unit * v_qty, 2)
  );

  UPDATE public.program_charge_lines
  SET
    unit_amount = v_unit,
    quantity = v_qty,
    amount = v_amount,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status', 'adjusted',
      'adjustment_reason', COALESCE(p_reason, ''),
      'original_amount', COALESCE(
        NULLIF(metadata->>'original_amount', '')::numeric,
        v_line.amount
      ),
      'adjusted_at', NOW(),
      'adjusted_by', auth.uid()
    )
  WHERE id = p_line_id;

  PERFORM public.recalculate_program_charge_from_lines(
    p_organization_id,
    v_line.charge_id
  );

  RETURN p_line_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Add a charge line (e.g. lunch, materials)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_program_charge_line(
  p_organization_id uuid,
  p_charge_id uuid,
  p_line_type text,
  p_label text,
  p_unit_amount numeric,
  p_quantity numeric DEFAULT 1,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge record;
  v_line_id uuid;
  v_sort integer;
  v_amount numeric;
BEGIN
  IF NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'charge:unauthorized';
  END IF;

  SELECT * INTO v_charge
  FROM public.program_charges c
  WHERE c.id = p_charge_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'charge:not-found';
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1
  INTO v_sort
  FROM public.program_charge_lines
  WHERE charge_id = p_charge_id;

  v_amount := ROUND(COALESCE(p_unit_amount, 0) * COALESCE(p_quantity, 1), 2);

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
    p_charge_id,
    COALESCE(NULLIF(btrim(p_line_type), ''), 'custom'),
    COALESCE(NULLIF(btrim(p_label), ''), 'Fee'),
    COALESCE(p_quantity, 1),
    COALESCE(p_unit_amount, 0),
    v_amount,
    v_sort,
    jsonb_build_object(
      'status', 'active',
      'added_by', auth.uid(),
      'add_reason', COALESCE(p_reason, ''),
      'source', 'staff_manual'
    )
  )
  RETURNING id INTO v_line_id;

  PERFORM public.recalculate_program_charge_from_lines(
    p_organization_id,
    p_charge_id
  );

  RETURN v_line_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_ensure_enrollment_charge(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_program_charge_line(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_program_charge_line(uuid, uuid, numeric, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_program_charge_line(uuid, uuid, text, text, numeric, numeric, text) TO authenticated;

REVOKE ALL ON FUNCTION public.recalculate_program_charge_from_lines(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Verification
-- ---------------------------------------------------------------------------
SELECT
  to_regprocedure('public.staff_ensure_enrollment_charge(uuid,uuid)') IS NOT NULL
    AS ensure_charge_rpc_exists,
  to_regprocedure('public.void_program_charge_line(uuid,uuid,text)') IS NOT NULL
    AS void_line_rpc_exists,
  to_regprocedure('public.adjust_program_charge_line(uuid,uuid,numeric,numeric,numeric,text)') IS NOT NULL
    AS adjust_line_rpc_exists,
  to_regprocedure('public.add_program_charge_line(uuid,uuid,text,text,numeric,numeric,text)') IS NOT NULL
    AS add_line_rpc_exists;
