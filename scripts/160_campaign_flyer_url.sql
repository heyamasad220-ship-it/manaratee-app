-- Optional promotional flyer for donation campaigns (customer portal dashboard).
-- Run after 159_customer_pledge_plan_update.sql

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS flyer_url TEXT;

COMMENT ON COLUMN public.campaigns.flyer_url IS
  'Public URL for the campaign flyer image shown on the customer portal dashboard.';
