-- Optional dollar total and an existing-pledge link on a recurring plan.
-- A pledge stays a promise with no schedule. A plan linked to a pledge
-- stops when that pledge's remaining balance reaches zero.
-- Run after 311_pledge_contact_method.sql

ALTER TABLE public.recurring_donation_plans
  ADD COLUMN IF NOT EXISTS goal_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS pledge_id UUID REFERENCES public.pledges(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_donation_plans
  DROP CONSTRAINT IF EXISTS recurring_donation_plans_goal_amount_check;

ALTER TABLE public.recurring_donation_plans
  ADD CONSTRAINT recurring_donation_plans_goal_amount_check
  CHECK (goal_amount IS NULL OR goal_amount > 0);

CREATE INDEX IF NOT EXISTS recurring_donation_plans_pledge_idx
  ON public.recurring_donation_plans (pledge_id)
  WHERE pledge_id IS NOT NULL;

COMMENT ON COLUMN public.recurring_donation_plans.goal_amount IS
  'Optional collected-dollar cap. Null means the plan continues until cancelled. Ignored when pledge_id is set.';

COMMENT ON COLUMN public.recurring_donation_plans.pledge_id IS
  'Open pledge this plan pays down. Successful charges set payments.pledge_id. The pledge balance is the finish line.';
