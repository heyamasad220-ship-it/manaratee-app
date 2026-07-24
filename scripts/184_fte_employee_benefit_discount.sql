-- =============================================================================
-- 184_fte_employee_benefit_discount.sql
-- Full-time employee benefit: 50% off Programs + Venue Rentals (not ticketing).
--
-- - organization_employee_benefits: org policy (percent, module flags)
-- - Seeds "Full-Time Employee" discount_tags per org
-- - contact_is_active_full_time_employee()
-- - apply_employee_benefit_discount_to_quote()
-- - Wraps compute_program_registration_quote so register + quote both apply it
--
-- Run in Supabase SQL Editor after 183.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Org benefit policy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_employee_benefits (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  percent_off NUMERIC(5,2) NOT NULL DEFAULT 50
    CHECK (percent_off >= 0 AND percent_off <= 100),
  applies_to_programs BOOLEAN NOT NULL DEFAULT true,
  applies_to_venue_rentals BOOLEAN NOT NULL DEFAULT true,
  applies_to_ticketing BOOLEAN NOT NULL DEFAULT false,
  discount_tag_id UUID REFERENCES public.discount_tags(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organization_employee_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read employee benefits"
  ON public.organization_employee_benefits;
CREATE POLICY "Org members read employee benefits"
  ON public.organization_employee_benefits FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org staff manage employee benefits"
  ON public.organization_employee_benefits;
CREATE POLICY "Org staff manage employee benefits"
  ON public.organization_employee_benefits FOR ALL
  USING (public.is_org_staff(organization_id, auth.uid()))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) Ensure Full-Time Employee discount tag + default policy per org
-- ---------------------------------------------------------------------------
INSERT INTO public.discount_tags (organization_id, name, description, active)
SELECT
  o.id,
  'Full-Time Employee',
  'Automatic 50% benefit for active full-time staff (programs and venue rentals).',
  true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.discount_tags dt
  WHERE dt.organization_id = o.id
    AND lower(regexp_replace(dt.name, '[^a-zA-Z0-9]+', ' ', 'g')) =
        lower(regexp_replace('Full-Time Employee', '[^a-zA-Z0-9]+', ' ', 'g'))
);

INSERT INTO public.organization_employee_benefits (
  organization_id,
  enabled,
  percent_off,
  applies_to_programs,
  applies_to_venue_rentals,
  applies_to_ticketing,
  discount_tag_id
)
SELECT
  o.id,
  true,
  50,
  true,
  true,
  false,
  dt.id
FROM public.organizations o
JOIN public.discount_tags dt
  ON dt.organization_id = o.id
 AND lower(regexp_replace(dt.name, '[^a-zA-Z0-9]+', ' ', 'g')) =
     lower(regexp_replace('Full-Time Employee', '[^a-zA-Z0-9]+', ' ', 'g'))
ON CONFLICT (organization_id) DO UPDATE
SET
  discount_tag_id = COALESCE(
    public.organization_employee_benefits.discount_tag_id,
    EXCLUDED.discount_tag_id
  ),
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 3) Eligibility: active full-time staff linked to contact
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contact_is_active_full_time_employee(
  p_organization_id uuid,
  p_contact_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.organization_id = p_organization_id
      AND s.contact_id = p_contact_id
      AND lower(COALESCE(s.status, '')) = 'active'
      AND lower(COALESCE(s.staff_type, '')) = 'full_time'
  );
$$;

GRANT EXECUTE ON FUNCTION public.contact_is_active_full_time_employee(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Apply benefit to a program quote JSON snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_employee_benefit_discount_to_quote(
  p_organization_id uuid,
  p_registrant_contact_id uuid,
  p_participant_contact_id uuid,
  p_quote jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy public.organization_employee_benefits;
  v_eligible boolean := false;
  v_subtotal numeric;
  v_discount_total numeric;
  v_benefit_amount numeric;
  v_total numeric;
  v_due_today numeric;
  v_plan_type text;
  v_discounts jsonb;
  v_ratio numeric;
  v_scheduled jsonb := '[]'::jsonb;
  v_item jsonb;
BEGIN
  IF p_quote IS NULL OR COALESCE((p_quote->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN p_quote;
  END IF;

  SELECT * INTO v_policy
  FROM public.organization_employee_benefits b
  WHERE b.organization_id = p_organization_id;

  IF NOT FOUND OR v_policy.enabled IS NOT TRUE OR v_policy.applies_to_programs IS NOT TRUE THEN
    RETURN p_quote;
  END IF;

  IF v_policy.percent_off IS NULL OR v_policy.percent_off <= 0 THEN
    RETURN p_quote;
  END IF;

  v_eligible :=
    public.contact_is_active_full_time_employee(p_organization_id, p_registrant_contact_id)
    OR public.contact_is_active_full_time_employee(p_organization_id, p_participant_contact_id);

  IF NOT v_eligible THEN
    RETURN p_quote;
  END IF;

  -- Avoid stacking if already applied
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_quote->'discounts', '[]'::jsonb)) d
    WHERE d->>'rule_type' = 'employee_benefit'
  ) THEN
    RETURN p_quote;
  END IF;

  v_subtotal := COALESCE((p_quote->>'subtotal')::numeric, 0);
  v_discount_total := COALESCE((p_quote->>'discount_total')::numeric, 0);
  v_total := COALESCE((p_quote->>'total')::numeric, 0);
  v_due_today := COALESCE((p_quote->>'due_today')::numeric, 0);
  v_plan_type := COALESCE(p_quote->>'plan_type', '');
  v_discounts := COALESCE(p_quote->'discounts', '[]'::jsonb);

  IF v_total <= 0 THEN
    RETURN p_quote;
  END IF;

  v_benefit_amount := ROUND(v_total * (v_policy.percent_off / 100.0), 2);
  IF v_benefit_amount <= 0 THEN
    RETURN p_quote;
  END IF;

  v_discounts := v_discounts || jsonb_build_array(
    jsonb_build_object(
      'rule_type', 'employee_benefit',
      'label', format('Full-time employee benefit (%s%% off)', trim(trailing '.' from to_char(v_policy.percent_off, 'FM999990.##'))),
      'amount', v_benefit_amount
    )
  );

  v_discount_total := ROUND(v_discount_total + v_benefit_amount, 2);
  v_ratio := CASE WHEN v_total > 0 THEN GREATEST(v_total - v_benefit_amount, 0) / v_total ELSE 0 END;
  v_total := GREATEST(ROUND(v_total - v_benefit_amount, 2), 0);
  v_due_today := GREATEST(ROUND(v_due_today * v_ratio, 2), 0);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_quote->'scheduled_payments', '[]'::jsonb))
  LOOP
    v_scheduled := v_scheduled || jsonb_build_array(
      jsonb_build_object(
        'label', v_item->>'label',
        'due_date', v_item->>'due_date',
        'amount', GREATEST(ROUND(COALESCE((v_item->>'amount')::numeric, 0) * v_ratio, 2), 0)
      )
    );
  END LOOP;

  RETURN p_quote
    || jsonb_build_object(
      'discounts', v_discounts,
      'discount_total', v_discount_total,
      'total', v_total,
      'due_today', v_due_today,
      'scheduled_payments', v_scheduled,
      'employee_benefit_applied', true,
      'employee_benefit_percent', v_policy.percent_off
    );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_employee_benefit_discount_to_quote(uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Wrap compute_program_registration_quote so all callers get the benefit
-- ---------------------------------------------------------------------------
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
    COALESCE(p_addons, '{}'::jsonb)
  );

  RETURN public.apply_employee_benefit_discount_to_quote(
    p_organization_id,
    p_registrant_contact_id,
    p_participant_contact_id,
    v_quote
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compute_program_registration_quote_base(uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_program_registration_quote(uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
SELECT
  to_regclass('public.organization_employee_benefits') IS NOT NULL AS benefits_table,
  to_regprocedure('public.contact_is_active_full_time_employee(uuid,uuid)') IS NOT NULL AS eligibility_fn,
  to_regprocedure('public.apply_employee_benefit_discount_to_quote(uuid,uuid,uuid,jsonb)') IS NOT NULL AS apply_fn,
  to_regprocedure('public.compute_program_registration_quote_base(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)') IS NOT NULL AS base_quote_fn,
  to_regprocedure('public.compute_program_registration_quote(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)') IS NOT NULL AS wrapped_quote_fn;
