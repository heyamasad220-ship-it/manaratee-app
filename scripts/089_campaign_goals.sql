-- Campaign fundraising goals and descriptions for donations analytics.
-- Run after 088_payments_source_type_check.sql

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS goal_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.campaigns.goal_amount IS
  'Fundraising target amount for progress tracking.';

COMMENT ON COLUMN public.campaigns.description IS
  'Optional campaign description shown on campaign detail and settings.';
