-- Add 'daily' as a valid recurring donation frequency.
-- Run after 092_recurring_donations.sql

ALTER TABLE public.recurring_donation_plans
  DROP CONSTRAINT IF EXISTS recurring_donation_plans_frequency_check;

ALTER TABLE public.recurring_donation_plans
  ADD CONSTRAINT recurring_donation_plans_frequency_check
    CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually'));
