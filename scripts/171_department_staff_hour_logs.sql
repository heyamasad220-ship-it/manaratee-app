-- Teacher hour logs (by date) + pay period approval for department payroll.
-- Run after 170_department_operating_finance.sql

CREATE TABLE IF NOT EXISTS public.department_staff_hour_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  work_date date NOT NULL,
  hours numeric(10, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_staff_hour_logs_unique
    UNIQUE (organization_id, department_id, staff_id, work_date)
);

CREATE INDEX IF NOT EXISTS department_staff_hour_logs_staff_date_idx
  ON public.department_staff_hour_logs (organization_id, department_id, staff_id, work_date);

ALTER TABLE public.department_staff_pay_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.department_staff_pay_entries
  ADD COLUMN IF NOT EXISTS period_start date;

ALTER TABLE public.department_staff_pay_entries
  ADD COLUMN IF NOT EXISTS period_end date;

ALTER TABLE public.department_staff_pay_entries
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.department_staff_pay_entries
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.department_staff_pay_entries
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'department_staff_pay_entries_status_check'
  ) THEN
    ALTER TABLE public.department_staff_pay_entries
      ADD CONSTRAINT department_staff_pay_entries_status_check
      CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Existing rows with amounts treated as approved so Budget keeps working.
UPDATE public.department_staff_pay_entries
SET status = 'approved',
    period_start = COALESCE(period_start, (period_key || '-01')::date),
    period_end = COALESCE(
      period_end,
      (date_trunc('month', (period_key || '-01')::date) + interval '1 month - 1 day')::date
    )
WHERE amount > 0 AND status = 'draft';

UPDATE public.department_staff_pay_entries
SET period_start = COALESCE(period_start, (period_key || '-01')::date),
    period_end = COALESCE(
      period_end,
      (date_trunc('month', (period_key || '-01')::date) + interval '1 month - 1 day')::date
    )
WHERE period_start IS NULL OR period_end IS NULL;

ALTER TABLE public.department_staff_hour_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members manage department hour logs"
  ON public.department_staff_hour_logs;
CREATE POLICY "Organization members manage department hour logs"
ON public.department_staff_hour_logs FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND COALESCE(status, 'active') = 'active'
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND COALESCE(status, 'active') = 'active'
  )
);

COMMENT ON TABLE public.department_staff_hour_logs IS
  'Daily hours logged by teachers; rolled into monthly pay periods for approval.';

COMMENT ON COLUMN public.department_staff_pay_entries.status IS
  'draft | pending (awaiting department head) | approved | rejected';
