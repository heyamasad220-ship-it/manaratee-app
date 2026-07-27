-- =============================================================================
-- 202_discount_tag_auto_apply.sql
-- Discount tags: optional percent + auto-apply module flags.
--
-- Custom tags (e.g. Top Donor) are assigned manually on contacts.
-- System tags (Member / Staff / FTE) still sync from activity.
-- When auto_apply is on, checkout uses percent_off for checked modules.
--
-- Run in Supabase SQL Editor after 201.
-- =============================================================================

ALTER TABLE public.discount_tags
  ADD COLUMN IF NOT EXISTS percent_off NUMERIC(5,2)
    CHECK (percent_off IS NULL OR (percent_off >= 0 AND percent_off <= 100)),
  ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS applies_to_programs BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS applies_to_venue_rentals BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS applies_to_ticketing BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.discount_tags.percent_off IS
  'Optional discount percent when auto_apply is enabled (0-100).';
COMMENT ON COLUMN public.discount_tags.auto_apply IS
  'When true, apply percent_off at checkout for contacts who have this tag.';
COMMENT ON COLUMN public.discount_tags.applies_to_programs IS
  'Auto-apply this tag discount to program registration quotes.';
COMMENT ON COLUMN public.discount_tags.applies_to_venue_rentals IS
  'Auto-apply this tag discount to venue rental space fees.';
COMMENT ON COLUMN public.discount_tags.applies_to_ticketing IS
  'Reserved for future ticketing auto-apply.';

-- Best auto-apply tag percent for a contact + module
CREATE OR REPLACE FUNCTION public.contact_best_auto_apply_tag_discount(
  p_organization_id uuid,
  p_contact_id uuid,
  p_module text
)
RETURNS TABLE (
  percent_off numeric,
  tag_id uuid,
  tag_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dt.percent_off,
    dt.id AS tag_id,
    dt.name AS tag_name
  FROM public.contacts c
  JOIN public.person_tags pt
    ON pt.person_id = c.person_id
   AND pt.organization_id = c.organization_id
  JOIN public.discount_tags dt
    ON dt.id = pt.tag_id
   AND dt.organization_id = c.organization_id
  WHERE c.organization_id = p_organization_id
    AND c.id = p_contact_id
    AND c.person_id IS NOT NULL
    AND dt.active IS TRUE
    AND dt.auto_apply IS TRUE
    AND dt.percent_off IS NOT NULL
    AND dt.percent_off > 0
    AND (
      (p_module = 'programs' AND dt.applies_to_programs IS TRUE)
      OR (p_module = 'venue_rentals' AND dt.applies_to_venue_rentals IS TRUE)
      OR (p_module = 'ticketing' AND dt.applies_to_ticketing IS TRUE)
    )
  ORDER BY dt.percent_off DESC, dt.name ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.contact_best_auto_apply_tag_discount(uuid, uuid, text)
  TO authenticated;

-- Apply the best of FTE benefit vs auto-apply tag discounts to a program quote
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
  v_fte_eligible boolean := false;
  v_fte_percent numeric := 0;
  v_tag_percent numeric := 0;
  v_tag_name text := null;
  v_best_percent numeric := 0;
  v_label text;
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
  v_tag_reg RECORD;
  v_tag_part RECORD;
BEGIN
  IF p_quote IS NULL OR COALESCE((p_quote->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN p_quote;
  END IF;

  -- Avoid stacking if already applied
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_quote->'discounts', '[]'::jsonb)) d
    WHERE d->>'rule_type' IN ('employee_benefit', 'discount_tag_auto_apply')
  ) THEN
    RETURN p_quote;
  END IF;

  SELECT * INTO v_policy
  FROM public.organization_employee_benefits b
  WHERE b.organization_id = p_organization_id;

  IF FOUND
     AND v_policy.enabled IS TRUE
     AND v_policy.applies_to_programs IS TRUE
     AND v_policy.percent_off IS NOT NULL
     AND v_policy.percent_off > 0
  THEN
    v_fte_eligible :=
      public.contact_is_active_full_time_employee(p_organization_id, p_registrant_contact_id)
      OR public.contact_is_active_full_time_employee(p_organization_id, p_participant_contact_id);
    IF v_fte_eligible THEN
      v_fte_percent := v_policy.percent_off;
    END IF;
  END IF;

  SELECT * INTO v_tag_reg
  FROM public.contact_best_auto_apply_tag_discount(
    p_organization_id,
    p_registrant_contact_id,
    'programs'
  );
  IF FOUND AND v_tag_reg.percent_off IS NOT NULL THEN
    v_tag_percent := v_tag_reg.percent_off;
    v_tag_name := v_tag_reg.tag_name;
  END IF;

  SELECT * INTO v_tag_part
  FROM public.contact_best_auto_apply_tag_discount(
    p_organization_id,
    p_participant_contact_id,
    'programs'
  );
  IF FOUND
     AND v_tag_part.percent_off IS NOT NULL
     AND v_tag_part.percent_off > v_tag_percent
  THEN
    v_tag_percent := v_tag_part.percent_off;
    v_tag_name := v_tag_part.tag_name;
  END IF;

  IF v_fte_percent >= v_tag_percent AND v_fte_percent > 0 THEN
    v_best_percent := v_fte_percent;
    v_label := format(
      'Full-time employee benefit (%s%% off)',
      trim(trailing '.' from to_char(v_best_percent, 'FM999990.##'))
    );
  ELSIF v_tag_percent > 0 THEN
    v_best_percent := v_tag_percent;
    v_label := format(
      '%s (%s%% off)',
      COALESCE(v_tag_name, 'Discount tag'),
      trim(trailing '.' from to_char(v_best_percent, 'FM999990.##'))
    );
  ELSE
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

  v_benefit_amount := ROUND(v_total * (v_best_percent / 100.0), 2);
  IF v_benefit_amount <= 0 THEN
    RETURN p_quote;
  END IF;

  v_discounts := v_discounts || jsonb_build_array(
    jsonb_build_object(
      'rule_type',
      CASE
        WHEN v_fte_percent >= v_tag_percent AND v_fte_percent > 0 THEN 'employee_benefit'
        ELSE 'discount_tag_auto_apply'
      END,
      'label', v_label,
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
      'employee_benefit_applied', (v_fte_percent >= v_tag_percent AND v_fte_percent > 0),
      'employee_benefit_percent',
        CASE
          WHEN v_fte_percent >= v_tag_percent AND v_fte_percent > 0 THEN v_best_percent
          ELSE NULL
        END,
      'discount_tag_auto_apply', (v_tag_percent > v_fte_percent AND v_tag_percent > 0),
      'discount_tag_auto_apply_percent',
        CASE
          WHEN v_tag_percent > v_fte_percent AND v_tag_percent > 0 THEN v_best_percent
          ELSE NULL
        END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_employee_benefit_discount_to_quote(uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
