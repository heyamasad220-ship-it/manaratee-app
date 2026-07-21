-- Staff pay basis: hourly (hours × hourly_rate) or monthly fixed salary.
-- Run in Supabase SQL Editor after 168_staff_hourly_rate.sql

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS pay_basis text NOT NULL DEFAULT 'hourly';

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS monthly_salary numeric(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_pay_basis_check'
  ) THEN
    ALTER TABLE public.staff
      ADD CONSTRAINT staff_pay_basis_check
      CHECK (pay_basis IN ('hourly', 'monthly'));
  END IF;
END $$;

COMMENT ON COLUMN public.staff.pay_basis IS
  'Compensation method: hourly (use hourly_rate + hours) or monthly (use monthly_salary).';

COMMENT ON COLUMN public.staff.monthly_salary IS
  'Fixed monthly salary when pay_basis = monthly (USD).';
