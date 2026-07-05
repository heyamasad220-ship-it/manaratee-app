-- Square recurring plan metadata: expected and completed payment counts.
-- Run after 155_recurring_daily_frequency.sql

ALTER TABLE public.recurring_donation_plans
  ADD COLUMN IF NOT EXISTS total_payments INTEGER,
  ADD COLUMN IF NOT EXISTS payments_made INTEGER;

COMMENT ON COLUMN public.recurring_donation_plans.total_payments IS
  'Expected number of payments in the plan (from processor export).';

COMMENT ON COLUMN public.recurring_donation_plans.payments_made IS
  'Number of payments completed under this plan (from processor export or linked payments).';
