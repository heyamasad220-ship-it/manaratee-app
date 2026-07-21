-- Staff hourly rate for HR compensation on employee records.
-- Run in Supabase SQL Editor after 167_giving_group_category.sql

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(12, 2);

COMMENT ON COLUMN public.staff.hourly_rate IS
  'Optional hourly pay rate for this employee (USD).';
