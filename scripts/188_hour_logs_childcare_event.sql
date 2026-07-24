-- Link department hour logs to childcare event sessions (event → payroll hours).
-- Run after 187_finance_module_and_payroll_paid.sql. Safe to re-run.

ALTER TABLE public.department_staff_hour_logs
  ADD COLUMN IF NOT EXISTS childcare_event_id uuid
    REFERENCES public.childcare_events (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'department_staff_hour_logs_source_check'
  ) THEN
    ALTER TABLE public.department_staff_hour_logs
      DROP CONSTRAINT department_staff_hour_logs_source_check;
  END IF;

  ALTER TABLE public.department_staff_hour_logs
    ADD CONSTRAINT department_staff_hour_logs_source_check
    CHECK (source IN ('manual', 'childcare_event'));
END $$;

-- Allow multiple event hour rows on the same day; keep one manual row per day.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'department_staff_hour_logs_unique'
  ) THEN
    ALTER TABLE public.department_staff_hour_logs
      DROP CONSTRAINT department_staff_hour_logs_unique;
  END IF;
END $$;

DROP INDEX IF EXISTS department_staff_hour_logs_manual_day_unique;
CREATE UNIQUE INDEX department_staff_hour_logs_manual_day_unique
  ON public.department_staff_hour_logs (
    organization_id,
    department_id,
    staff_id,
    work_date
  )
  WHERE childcare_event_id IS NULL;

DROP INDEX IF EXISTS department_staff_hour_logs_event_unique;
CREATE UNIQUE INDEX department_staff_hour_logs_event_unique
  ON public.department_staff_hour_logs (
    organization_id,
    department_id,
    staff_id,
    childcare_event_id
  )
  WHERE childcare_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS department_staff_hour_logs_event_idx
  ON public.department_staff_hour_logs (organization_id, childcare_event_id)
  WHERE childcare_event_id IS NOT NULL;

COMMENT ON COLUMN public.department_staff_hour_logs.childcare_event_id IS
  'When set, hours were logged from a childcare event assignment (Finance/payroll provenance).';
COMMENT ON COLUMN public.department_staff_hour_logs.source IS
  'manual | childcare_event';
