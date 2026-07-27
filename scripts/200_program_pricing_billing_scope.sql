-- Per-fee household vs individual billing, and full-payment discount rule type.
-- Run in Supabase SQL editor after review.

ALTER TABLE public.program_offering_fee_plan_components
  ADD COLUMN IF NOT EXISTS billing_scope TEXT NOT NULL DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'program_offering_fee_plan_components_billing_scope_check'
  ) THEN
    ALTER TABLE public.program_offering_fee_plan_components
      ADD CONSTRAINT program_offering_fee_plan_components_billing_scope_check
      CHECK (billing_scope IN ('individual', 'family'));
  END IF;
END $$;

ALTER TABLE public.program_offering_discount_rules
  DROP CONSTRAINT IF EXISTS program_offering_discount_rules_rule_type_check;

ALTER TABLE public.program_offering_discount_rules
  ADD CONSTRAINT program_offering_discount_rules_rule_type_check
  CHECK (
    rule_type IN (
      'sibling',
      'multi_session',
      'early_bird',
      'full_payment',
      'custom'
    )
  );

COMMENT ON COLUMN public.program_offering_fee_plan_components.billing_scope IS
  'individual = per registrant; family = flat household amount once per family.';
