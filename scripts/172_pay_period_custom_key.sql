-- Allow custom pay-period keys (e.g. 2026-08-17_2026-08-31), not only YYYY-MM.
-- Run after 171_department_staff_hour_logs.sql

ALTER TABLE public.department_staff_pay_entries
  DROP CONSTRAINT IF EXISTS department_staff_pay_entries_period_key_check;

ALTER TABLE public.department_staff_pay_entries
  ADD CONSTRAINT department_staff_pay_entries_period_key_check
  CHECK (
    period_key ~ '^\d{4}-\d{2}$'
    OR period_key ~ '^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$'
  );

COMMENT ON COLUMN public.department_staff_pay_entries.period_key IS
  'Calendar month (YYYY-MM) or custom range (YYYY-MM-DD_YYYY-MM-DD).';
