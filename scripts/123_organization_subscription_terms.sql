-- Organization subscription terms: start date, complimentary period, first-year pricing
-- Run after 122_org_billing_super_admin_role_access.sql

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_start_date DATE,
  ADD COLUMN IF NOT EXISTS complimentary_months INTEGER NOT NULL DEFAULT 0
    CHECK (complimentary_months >= 0 AND complimentary_months <= 24),
  ADD COLUMN IF NOT EXISTS first_year_special_monthly_rate NUMERIC(12, 2);

COMMENT ON COLUMN public.organizations.subscription_start_date IS
  'Calendar date when the organization subscription term begins.';

COMMENT ON COLUMN public.organizations.complimentary_months IS
  'Number of months after subscription_start_date with no platform charge (e.g. 3 for three months free).';

COMMENT ON COLUMN public.organizations.first_year_special_monthly_rate IS
  'Optional promotional monthly rate for the first subscription year. After year one, standard plan pricing applies.';
