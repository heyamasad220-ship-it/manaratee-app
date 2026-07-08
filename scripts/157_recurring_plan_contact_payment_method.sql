-- Link recurring plans to on-file contact cards (contact_payment_methods).
-- Run after 138_contact_payment_methods.sql and 156_recurring_plan_payment_counts.sql.

ALTER TABLE public.recurring_donation_plans
  ADD COLUMN IF NOT EXISTS contact_payment_method_id UUID
  REFERENCES public.contact_payment_methods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recurring_donation_plans_contact_pm_idx
  ON public.recurring_donation_plans (contact_payment_method_id)
  WHERE contact_payment_method_id IS NOT NULL;

COMMENT ON COLUMN public.recurring_donation_plans.contact_payment_method_id IS
  'On-file card for this recurring plan (contact_payment_methods). Distinct from legacy payment_methods.';
