-- Phase 2B extension: billing calendar alignment, charge schedule rows, admin overrides
-- Run after 020_program_charge_ledger_foundation.sql
--
-- Adds:
--   • Offering billing periods (Sep–May calendar, not N months from registration)
--   • Late-enrollment proration in quote engine
--   • Individual scheduled charge rows with waive/adjust/admin audit fields
--   • Offering-level and enrollment-level billing overrides
--   • Staff RPCs for charge schedule management (no Stripe / no payments)

-- ---------------------------------------------------------------------------
-- 0) Preconditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.program_charge_schedule') IS NULL THEN
    RAISE EXCEPTION '021: program_charge_schedule missing — run 020 first';
  END IF;

  IF to_regprocedure(
    'public.compute_program_registration_quote(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION '021: compute_program_registration_quote missing — run 019 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) Billing calendar helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.offering_billing_period_start(
  p_reference_date date
)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT date_trunc('month', COALESCE(p_reference_date, CURRENT_DATE))::date;
$$;

CREATE OR REPLACE FUNCTION public.count_offering_billing_months_from_date(
  p_start_date date,
  p_end_date date,
  p_from_date date
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

  v_start := public.offering_billing_period_start(
    GREATEST(COALESCE(p_from_date, p_start_date), p_start_date)
  );
  v_end := public.offering_billing_period_start(p_end_date);

  WHILE v_start <= v_end LOOP
    v_count := v_count + 1;
    v_start := (v_start + INTERVAL '1 month')::date;
  END LOOP;

  RETURN GREATEST(v_count, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.format_billing_period_label(p_period_start date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(COALESCE(p_period_start, CURRENT_DATE), 'FMMonth YYYY');
$$;

CREATE OR REPLACE FUNCTION public.resolve_billing_period_due_date(
  p_period_start date,
  p_payment_due_day integer DEFAULT NULL
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_due date;
BEGIN
  IF p_payment_due_day IS NULL THEN
    RETURN p_period_start;
  END IF;

  v_due := make_date(
    EXTRACT(YEAR FROM p_period_start)::integer,
    EXTRACT(MONTH FROM p_period_start)::integer,
    LEAST(GREATEST(p_payment_due_day, 1), 28)
  );

  RETURN v_due;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Offering billing periods (canonical calendar)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_offering_billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  default_tuition_amount NUMERIC(12,2),
  period_status TEXT NOT NULL DEFAULT 'active' CHECK (
    period_status IN ('active', 'skipped')
  ),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, offering_id, period_key)
);

CREATE INDEX IF NOT EXISTS program_offering_billing_periods_offering_idx
  ON public.program_offering_billing_periods(organization_id, offering_id, sequence_number);

COMMENT ON TABLE public.program_offering_billing_periods IS
  'Canonical monthly billing calendar for an offering (e.g. Sep–May), independent of registration date.';

-- ---------------------------------------------------------------------------
-- 3) Billing overrides (offering-wide or per-enrollment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_billing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  billing_period_id UUID REFERENCES public.program_offering_billing_periods(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.program_enrollments(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (
    override_type IN ('skip', 'waive', 'adjust_amount', 'add_fee')
  ),
  label TEXT NOT NULL,
  amount NUMERIC(12,2),
  original_amount NUMERIC(12,2),
  reason TEXT,
  admin_notes TEXT,
  apply_to_all BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT program_billing_overrides_scope_check CHECK (
    apply_to_all = true OR enrollment_id IS NOT NULL OR billing_period_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS program_billing_overrides_offering_idx
  ON public.program_billing_overrides(organization_id, offering_id, billing_period_id);

CREATE INDEX IF NOT EXISTS program_billing_overrides_enrollment_idx
  ON public.program_billing_overrides(organization_id, enrollment_id);

-- ---------------------------------------------------------------------------
-- 4) Extend charge schedule for admin management
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_charge_schedule
  ADD COLUMN IF NOT EXISTS billing_period_id UUID REFERENCES public.program_offering_billing_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS charge_category TEXT NOT NULL DEFAULT 'tuition',
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS adjustment_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS override_id UUID REFERENCES public.program_billing_overrides(id) ON DELETE SET NULL;

ALTER TABLE public.program_charge_schedule
  DROP CONSTRAINT IF EXISTS program_charge_schedule_status_check;

ALTER TABLE public.program_charge_schedule
  ADD CONSTRAINT program_charge_schedule_status_check
  CHECK (
    status IN ('scheduled', 'due', 'paid', 'waived', 'void', 'adjusted', 'past_due')
  );

ALTER TABLE public.program_charge_schedule
  DROP CONSTRAINT IF EXISTS program_charge_schedule_charge_category_check;

ALTER TABLE public.program_charge_schedule
  ADD CONSTRAINT program_charge_schedule_charge_category_check
  CHECK (
    charge_category IN (
      'tuition', 'registration_fee', 'one_time_fee', 'addon', 'adjustment', 'materials', 'custom'
    )
  );

CREATE INDEX IF NOT EXISTS program_charge_schedule_billing_period_idx
  ON public.program_charge_schedule(organization_id, billing_period_id);

-- ---------------------------------------------------------------------------
-- 5) Sync offering billing periods from offering dates
-- ---------------------------------------------------------------------------
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
      public.resolve_billing_period_due_date(v_cursor, p_payment_due_day),
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

    v_count := v_count + 1;
    v_cursor := (v_cursor + INTERVAL '1 month')::date;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Build schedule rows from billing calendar (late enrollment aware)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_charge_schedule_from_billing_calendar(
  p_organization_id uuid,
  p_charge_id uuid,
  p_offering_id uuid,
  p_enrollment_date date,
  p_monthly_amount numeric,
  p_registration_fee numeric DEFAULT 0,
  p_payment_due_day integer DEFAULT NULL,
  p_include_first_month_in_due_today boolean DEFAULT true,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering record;
  v_period record;
  v_seq integer := 0;
  v_count integer := 0;
  v_enrollment_month date;
  v_amount numeric;
  v_is_first boolean := true;
BEGIN
  SELECT o.* INTO v_offering
  FROM public.program_offerings o
  WHERE o.id = p_offering_id
    AND o.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing:invalid-offering';
  END IF;

  PERFORM public.sync_offering_billing_periods(
    p_organization_id,
    p_offering_id,
    p_monthly_amount,
    p_payment_due_day
  );

  v_enrollment_month := public.offering_billing_period_start(
    COALESCE(p_enrollment_date, CURRENT_DATE)
  );

  IF p_registration_fee > 0 THEN
    INSERT INTO public.program_charge_schedule (
      organization_id,
      charge_id,
      schedule_type,
      charge_category,
      label,
      due_date,
      amount,
      original_amount,
      sequence_number,
      status,
      created_by
    )
    VALUES (
      p_organization_id,
      p_charge_id,
      'custom',
      'registration_fee',
      'Registration fee',
      COALESCE(p_enrollment_date, CURRENT_DATE),
      p_registration_fee,
      p_registration_fee,
      v_seq,
      CASE WHEN p_include_first_month_in_due_today THEN 'due' ELSE 'scheduled' END,
      p_actor_user_id
    );
    v_seq := v_seq + 1;
    v_count := v_count + 1;
  END IF;

  FOR v_period IN
    SELECT bp.*
    FROM public.program_offering_billing_periods bp
    WHERE bp.organization_id = p_organization_id
      AND bp.offering_id = p_offering_id
      AND bp.period_status = 'active'
      AND bp.period_start >= GREATEST(
        v_enrollment_month,
        public.offering_billing_period_start(COALESCE(v_offering.start_date, bp.period_start))
      )
    ORDER BY bp.sequence_number
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.program_billing_overrides o
      WHERE o.organization_id = p_organization_id
        AND o.offering_id = p_offering_id
        AND o.billing_period_id = v_period.id
        AND o.apply_to_all = true
        AND o.override_type = 'skip'
    ) THEN
      CONTINUE;
    END IF;

    v_amount := COALESCE(v_period.default_tuition_amount, p_monthly_amount, 0);

    SELECT COALESCE(o.amount, v_amount)
    INTO v_amount
    FROM public.program_billing_overrides o
    WHERE o.organization_id = p_organization_id
      AND o.offering_id = p_offering_id
      AND o.billing_period_id = v_period.id
      AND o.apply_to_all = true
      AND o.override_type = 'adjust_amount'
    ORDER BY o.created_at DESC
    LIMIT 1;

    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.program_charge_schedule (
      organization_id,
      charge_id,
      billing_period_id,
      schedule_type,
      charge_category,
      label,
      due_date,
      amount,
      original_amount,
      sequence_number,
      status,
      created_by
    )
    VALUES (
      p_organization_id,
      p_charge_id,
      v_period.id,
      'monthly',
      'tuition',
      v_period.period_label || ' tuition',
      v_period.due_date,
      v_amount,
      v_amount,
      v_seq,
      CASE
        WHEN v_is_first AND p_include_first_month_in_due_today THEN 'due'
        ELSE 'scheduled'
      END,
      p_actor_user_id
    );

    v_is_first := false;
    v_seq := v_seq + 1;
    v_count := v_count + 1;
  END LOOP;

  FOR v_period IN
    SELECT o.*, bp.period_label, bp.due_date AS period_due_date
    FROM public.program_billing_overrides o
    JOIN public.program_offering_billing_periods bp
      ON bp.id = o.billing_period_id
    WHERE o.organization_id = p_organization_id
      AND o.offering_id = p_offering_id
      AND o.apply_to_all = true
      AND o.override_type = 'add_fee'
      AND o.enrollment_id IS NULL
  LOOP
    INSERT INTO public.program_charge_schedule (
      organization_id,
      charge_id,
      billing_period_id,
      schedule_type,
      charge_category,
      label,
      due_date,
      amount,
      original_amount,
      sequence_number,
      status,
      adjustment_reason,
      admin_notes,
      override_id,
      created_by
    )
    VALUES (
      p_organization_id,
      p_charge_id,
      v_period.billing_period_id,
      'custom',
      'one_time_fee',
      v_period.label,
      COALESCE(v_period.period_due_date, p_enrollment_date),
      COALESCE(v_period.amount, 0),
      COALESCE(v_period.amount, 0),
      v_seq,
      'scheduled',
      v_period.reason,
      v_period.admin_notes,
      v_period.id,
      p_actor_user_id
    );
    v_seq := v_seq + 1;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) Admin RPCs — schedule item management (no payment processing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.waive_charge_schedule_item(
  p_organization_id uuid,
  p_schedule_id uuid,
  p_reason text DEFAULT NULL,
  p_admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'billing:unauthorized';
  END IF;

  SELECT * INTO v_row
  FROM public.program_charge_schedule s
  WHERE s.id = p_schedule_id
    AND s.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing:schedule-not-found';
  END IF;

  IF v_row.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'billing:schedule-not-editable';
  END IF;

  UPDATE public.program_charge_schedule
  SET
    status = 'waived',
    original_amount = COALESCE(original_amount, amount),
    amount = 0,
    adjustment_reason = COALESCE(p_reason, adjustment_reason),
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_schedule_id;

  RETURN p_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_charge_schedule_item(
  p_organization_id uuid,
  p_schedule_id uuid,
  p_new_amount numeric,
  p_reason text DEFAULT NULL,
  p_admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  IF NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'billing:unauthorized';
  END IF;

  SELECT * INTO v_row
  FROM public.program_charge_schedule s
  WHERE s.id = p_schedule_id
    AND s.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing:schedule-not-found';
  END IF;

  IF v_row.status IN ('paid', 'void', 'waived') THEN
    RAISE EXCEPTION 'billing:schedule-not-editable';
  END IF;

  UPDATE public.program_charge_schedule
  SET
    status = 'adjusted',
    original_amount = COALESCE(original_amount, amount),
    amount = GREATEST(COALESCE(p_new_amount, 0), 0),
    adjustment_reason = COALESCE(p_reason, adjustment_reason),
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_schedule_id;

  RETURN p_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_enrollment_schedule_fee(
  p_organization_id uuid,
  p_enrollment_id uuid,
  p_label text,
  p_amount numeric,
  p_billing_period_id uuid DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_admin_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge_id uuid;
  v_due date;
  v_seq integer;
  v_schedule_id uuid;
BEGIN
  IF NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'billing:unauthorized';
  END IF;

  SELECT e.charge_id INTO v_charge_id
  FROM public.program_enrollments e
  WHERE e.id = p_enrollment_id
    AND e.organization_id = p_organization_id;

  IF v_charge_id IS NULL THEN
    RAISE EXCEPTION 'billing:no-charge';
  END IF;

  SELECT COALESCE(MAX(sequence_number), -1) + 1
  INTO v_seq
  FROM public.program_charge_schedule
  WHERE charge_id = v_charge_id;

  IF p_billing_period_id IS NOT NULL THEN
    SELECT bp.due_date INTO v_due
    FROM public.program_offering_billing_periods bp
    WHERE bp.id = p_billing_period_id
      AND bp.organization_id = p_organization_id;
  END IF;

  v_due := COALESCE(p_due_date, v_due, CURRENT_DATE);

  INSERT INTO public.program_charge_schedule (
    organization_id,
    charge_id,
    billing_period_id,
    schedule_type,
    charge_category,
    label,
    due_date,
    amount,
    original_amount,
    sequence_number,
    status,
    adjustment_reason,
    admin_notes,
    created_by
  )
  VALUES (
    p_organization_id,
    v_charge_id,
    p_billing_period_id,
    'custom',
    'one_time_fee',
    p_label,
    v_due,
    GREATEST(COALESCE(p_amount, 0), 0),
    GREATEST(COALESCE(p_amount, 0), 0),
    v_seq,
    'scheduled',
    p_reason,
    p_admin_notes,
    auth.uid()
  )
  RETURNING id INTO v_schedule_id;

  RETURN v_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_offering_billing_override(
  p_organization_id uuid,
  p_offering_id uuid,
  p_override_type text,
  p_label text,
  p_billing_period_id uuid DEFAULT NULL,
  p_enrollment_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_admin_notes text DEFAULT NULL,
  p_apply_to_all boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering record;
  v_override_id uuid;
  v_enrollment record;
BEGIN
  IF NOT public.is_org_staff(p_organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'billing:unauthorized';
  END IF;

  SELECT o.* INTO v_offering
  FROM public.program_offerings o
  WHERE o.id = p_offering_id
    AND o.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'billing:invalid-offering';
  END IF;

  INSERT INTO public.program_billing_overrides (
    organization_id,
    program_id,
    offering_id,
    billing_period_id,
    enrollment_id,
    override_type,
    label,
    amount,
    reason,
    admin_notes,
    apply_to_all,
    created_by,
    updated_by
  )
  VALUES (
    p_organization_id,
    v_offering.program_id,
    p_offering_id,
    p_billing_period_id,
    p_enrollment_id,
    p_override_type,
    p_label,
    p_amount,
    p_reason,
    p_admin_notes,
    COALESCE(p_apply_to_all, false),
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_override_id;

  IF p_apply_to_all AND p_enrollment_id IS NULL THEN
    FOR v_enrollment IN
      SELECT e.id, e.charge_id
      FROM public.program_enrollments e
      WHERE e.organization_id = p_organization_id
        AND e.offering_id = p_offering_id
        AND e.charge_id IS NOT NULL
        AND lower(COALESCE(e.status, '')) NOT IN ('cancelled', 'withdrawn', 'expired')
    LOOP
      IF p_override_type = 'waive' AND p_billing_period_id IS NOT NULL THEN
        UPDATE public.program_charge_schedule s
        SET
          status = 'waived',
          original_amount = COALESCE(s.original_amount, s.amount),
          amount = 0,
          adjustment_reason = COALESCE(p_reason, s.adjustment_reason),
          admin_notes = COALESCE(p_admin_notes, s.admin_notes),
          override_id = v_override_id,
          updated_by = auth.uid(),
          updated_at = NOW()
        FROM public.program_charges c
        WHERE s.charge_id = c.id
          AND c.enrollment_id = v_enrollment.id
          AND s.billing_period_id = p_billing_period_id
          AND s.status NOT IN ('paid', 'void', 'waived');
      ELSIF p_override_type = 'adjust_amount' AND p_billing_period_id IS NOT NULL THEN
        UPDATE public.program_charge_schedule s
        SET
          status = 'adjusted',
          original_amount = COALESCE(s.original_amount, s.amount),
          amount = GREATEST(COALESCE(p_amount, 0), 0),
          adjustment_reason = COALESCE(p_reason, s.adjustment_reason),
          admin_notes = COALESCE(p_admin_notes, s.admin_notes),
          override_id = v_override_id,
          updated_by = auth.uid(),
          updated_at = NOW()
        FROM public.program_charges c
        WHERE s.charge_id = c.id
          AND c.enrollment_id = v_enrollment.id
          AND s.billing_period_id = p_billing_period_id
          AND s.status NOT IN ('paid', 'void', 'waived');
      ELSIF p_override_type = 'add_fee' THEN
        PERFORM public.add_enrollment_schedule_fee(
          p_organization_id,
          v_enrollment.id,
          p_label,
          p_amount,
          p_billing_period_id,
          NULL,
          p_reason,
          p_admin_notes
        );
      END IF;
    END LOOP;
  ELSIF p_enrollment_id IS NOT NULL THEN
    IF p_override_type = 'waive' AND p_billing_period_id IS NOT NULL THEN
      PERFORM public.waive_charge_schedule_item(
        p_organization_id,
        (
          SELECT s.id
          FROM public.program_charge_schedule s
          JOIN public.program_charges c ON c.id = s.charge_id
          WHERE c.enrollment_id = p_enrollment_id
            AND s.billing_period_id = p_billing_period_id
            AND s.organization_id = p_organization_id
          LIMIT 1
        ),
        p_reason,
        p_admin_notes
      );
    ELSIF p_override_type = 'adjust_amount' AND p_billing_period_id IS NOT NULL THEN
      PERFORM public.adjust_charge_schedule_item(
        p_organization_id,
        (
          SELECT s.id
          FROM public.program_charge_schedule s
          JOIN public.program_charges c ON c.id = s.charge_id
          WHERE c.enrollment_id = p_enrollment_id
            AND s.billing_period_id = p_billing_period_id
            AND s.organization_id = p_organization_id
          LIMIT 1
        ),
        p_amount,
        p_reason,
        p_admin_notes
      );
    ELSIF p_override_type = 'add_fee' THEN
      PERFORM public.add_enrollment_schedule_fee(
        p_organization_id,
        p_enrollment_id,
        p_label,
        p_amount,
        p_billing_period_id,
        NULL,
        p_reason,
        p_admin_notes
      );
    END IF;
  END IF;

  RETURN v_override_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.waive_charge_schedule_item(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_charge_schedule_item(uuid, uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_enrollment_schedule_fee(uuid, uuid, text, numeric, uuid, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_offering_billing_override(uuid, uuid, text, text, uuid, uuid, numeric, text, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Patch build_program_charge_from_quote — billing calendar schedule rows
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
  p_checkout_id uuid DEFAULT NULL,
  p_enrollment_date date DEFAULT CURRENT_DATE
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
  v_line_idx integer := 0;
  v_monthly_amount numeric := 0;
  v_registration_fee numeric := 0;
  v_payment_due_day integer;
  v_offering_id uuid;
BEGIN
  IF p_quote IS NULL OR COALESCE(p_quote->>'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'charge:invalid-quote';
  END IF;

  v_offering_id := COALESCE(
    p_offering_id,
    NULLIF(p_quote->>'offering_id', '')::uuid
  );

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

  IF v_fee_plan_id IS NOT NULL THEN
    SELECT fp.payment_due_day INTO v_payment_due_day
    FROM public.program_offering_fee_plans fp
    WHERE fp.id = v_fee_plan_id;
  END IF;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_quote->'line_items', '[]'::jsonb))
  LOOP
    IF COALESCE(v_line->>'component_type', '') = 'registration_fee' THEN
      v_registration_fee := v_registration_fee + COALESCE((v_line->>'amount')::numeric, 0);
    ELSIF COALESCE(v_line->>'component_type', '') = 'tuition'
      AND v_plan_type = 'monthly' THEN
      v_monthly_amount := v_monthly_amount + COALESCE((v_line->>'unit_amount')::numeric, 0);
    END IF;
  END LOOP;

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
    v_offering_id,
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

  IF v_plan_type = 'monthly' AND v_offering_id IS NOT NULL THEN
    PERFORM public.build_charge_schedule_from_billing_calendar(
      p_organization_id,
      v_charge_id,
      v_offering_id,
      COALESCE(p_enrollment_date, CURRENT_DATE),
      v_monthly_amount,
      v_registration_fee,
      v_payment_due_day,
      true,
      NULL
    );
  ELSE
    FOR v_line IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(p_quote->'scheduled_payments', '[]'::jsonb))
    LOOP
      INSERT INTO public.program_charge_schedule (
        organization_id,
        charge_id,
        schedule_type,
        charge_category,
        label,
        due_date,
        amount,
        original_amount,
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
        'tuition',
        COALESCE(NULLIF(v_line->>'label', ''), 'Scheduled payment'),
        NULLIF(v_line->>'due_date', '')::date,
        COALESCE((v_line->>'amount')::numeric, 0),
        COALESCE((v_line->>'amount')::numeric, 0),
        v_line_idx,
        'scheduled'
      );
      v_line_idx := v_line_idx + 1;
    END LOOP;
  END IF;

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
-- 9) Late-enrollment proration in quote engine (billing calendar aligned)
-- ---------------------------------------------------------------------------
-- Replaces monthly quantity + scheduled_payments logic when 019/019a version exists.
-- Uses participant month count (join month → offering end), not full offering months.

CREATE OR REPLACE FUNCTION public.build_monthly_quote_schedule(
  p_organization_id uuid,
  p_offering_id uuid,
  p_monthly_unit numeric,
  p_registration_fee numeric,
  p_recurring_total numeric,
  p_total numeric,
  p_payment_due_day integer,
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
BEGIN
  SELECT o.* INTO v_offering
  FROM public.program_offerings o
  WHERE o.id = p_offering_id
    AND o.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  PERFORM public.sync_offering_billing_periods(
    p_organization_id,
    p_offering_id,
    p_monthly_unit,
    p_payment_due_day
  );

  v_participant_month_count := public.count_offering_billing_months_from_date(
    COALESCE(v_offering.start_date, p_enrollment_date),
    COALESCE(v_offering.end_date, p_enrollment_date),
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

-- Patch compute_program_registration_quote monthly branch only (019a-compatible body excerpt)
-- Full function replacement preserves non-monthly behavior.

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
  v_scheduled_total numeric;
  v_i integer;
  v_due_date date;
  v_today date := CURRENT_DATE;
  v_balance_due_date date;
  v_last_installment numeric;
  v_monthly_schedule jsonb;
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

    IF v_comp.pricing_model = 'per_session'
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

REVOKE ALL ON FUNCTION public.build_charge_schedule_from_billing_calendar(
  uuid, uuid, uuid, date, numeric, numeric, integer, boolean, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_offering_billing_periods(
  uuid, uuid, numeric, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sync_offering_billing_periods(
  uuid, uuid, numeric, integer
) TO authenticated;

REVOKE ALL ON FUNCTION public.build_program_charge_from_quote(
  uuid, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, date
) FROM PUBLIC, anon, authenticated;

-- compute remains internal-only (019b lock preserved)
REVOKE ALL ON FUNCTION public.compute_program_registration_quote(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb
) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10) RLS for new tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_offering_billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_billing_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage offering billing periods" ON public.program_offering_billing_periods;
CREATE POLICY "Org members manage offering billing periods"
  ON public.program_offering_billing_periods FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members manage billing overrides" ON public.program_billing_overrides;
CREATE POLICY "Org members manage billing overrides"
  ON public.program_billing_overrides FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

GRANT SELECT ON public.program_offering_billing_periods TO authenticated;
GRANT SELECT ON public.program_billing_overrides TO authenticated;

-- ---------------------------------------------------------------------------
-- 11) Verification
-- ---------------------------------------------------------------------------
SELECT
  to_regclass('public.program_offering_billing_periods') IS NOT NULL AS billing_periods_exists,
  to_regclass('public.program_billing_overrides') IS NOT NULL AS billing_overrides_exists,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'program_charge_schedule'
      AND column_name = 'billing_period_id'
  ) AS schedule_billing_period_column_exists,
  to_regprocedure(
    'public.count_offering_billing_months_from_date(date,date,date)'
  ) IS NOT NULL AS proration_helper_exists,
  to_regprocedure(
    'public.create_offering_billing_override(uuid,uuid,text,text,uuid,uuid,numeric,text,text,boolean)'
  ) IS NOT NULL AS override_rpc_exists;
