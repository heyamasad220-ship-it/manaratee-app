-- Custom budget periods (start/end dates) for department operating P&L.
-- Run after 172_pay_period_custom_key.sql

CREATE TABLE IF NOT EXISTS public.department_budget_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_budget_periods_range_check
    CHECK (period_end >= period_start),
  CONSTRAINT department_budget_periods_unique
    UNIQUE (organization_id, department_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS department_budget_periods_dept_idx
  ON public.department_budget_periods (organization_id, department_id, period_start);

ALTER TABLE public.department_budget_periods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'department_budget_periods'
      AND policyname = 'department_budget_periods_org_access'
  ) THEN
    CREATE POLICY department_budget_periods_org_access
      ON public.department_budget_periods
      FOR ALL
      USING (
        organization_id IN (
          SELECT om.organization_id
          FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT om.organization_id
          FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;
