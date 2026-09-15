-- Unpaid / volunteer staff pay basis. Hourly rate and monthly salary stay on the
-- row so an employee can switch back to paid later without re-entering pay.
-- Run in Supabase SQL Editor after 169_staff_pay_basis.sql

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_pay_basis_check;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_pay_basis_check
  CHECK (pay_basis IN ('hourly', 'monthly', 'unpaid'));

COMMENT ON COLUMN public.staff.pay_basis IS
  'Compensation method: hourly (use hourly_rate + hours), monthly (use monthly_salary), or unpaid (volunteer; keep rates for later).';
