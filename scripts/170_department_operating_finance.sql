-- Department operating finance: teacher payroll, babysitting income/pay.
-- Feeds the department Budget P&L (separate from Group giving donations).
-- Run in Supabase SQL Editor after 169_staff_pay_basis.sql

CREATE TABLE IF NOT EXISTS public.department_staff_pay_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  period_key text NOT NULL,
  hours_worked numeric(10, 2),
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  pay_basis text,
  hourly_rate numeric(12, 2),
  monthly_salary numeric(12, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_staff_pay_entries_period_key_check
    CHECK (
      period_key ~ '^\d{4}-\d{2}$'
      OR period_key ~ '^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$'
    ),
  CONSTRAINT department_staff_pay_entries_unique
    UNIQUE (organization_id, department_id, staff_id, period_key)
);

CREATE INDEX IF NOT EXISTS department_staff_pay_entries_dept_period_idx
  ON public.department_staff_pay_entries (organization_id, department_id, period_key);

CREATE TABLE IF NOT EXISTS public.department_babysitting_income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  period_key text NOT NULL,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_babysitting_income_period_key_check
    CHECK (period_key ~ '^\d{4}-\d{2}$'),
  CONSTRAINT department_babysitting_income_unique
    UNIQUE (organization_id, department_id, period_key)
);

CREATE TABLE IF NOT EXISTS public.department_babysitting_pay_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  display_name text NOT NULL,
  period_key text NOT NULL,
  hours_worked numeric(10, 2),
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_babysitting_pay_period_key_check
    CHECK (period_key ~ '^\d{4}-\d{2}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS department_babysitting_pay_contact_period_uidx
  ON public.department_babysitting_pay_entries (
    organization_id,
    department_id,
    period_key,
    contact_id
  )
  WHERE contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS department_babysitting_pay_name_period_uidx
  ON public.department_babysitting_pay_entries (
    organization_id,
    department_id,
    period_key,
    lower(display_name)
  )
  WHERE contact_id IS NULL;

CREATE INDEX IF NOT EXISTS department_babysitting_pay_dept_period_idx
  ON public.department_babysitting_pay_entries (organization_id, department_id, period_key);

ALTER TABLE public.department_staff_pay_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_babysitting_income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_babysitting_pay_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members manage department staff pay"
  ON public.department_staff_pay_entries;
CREATE POLICY "Organization members manage department staff pay"
ON public.department_staff_pay_entries FOR ALL
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

DROP POLICY IF EXISTS "Organization members manage babysitting income"
  ON public.department_babysitting_income_entries;
CREATE POLICY "Organization members manage babysitting income"
ON public.department_babysitting_income_entries FOR ALL
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

DROP POLICY IF EXISTS "Organization members manage babysitting pay"
  ON public.department_babysitting_pay_entries;
CREATE POLICY "Organization members manage babysitting pay"
ON public.department_babysitting_pay_entries FOR ALL
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

COMMENT ON TABLE public.department_staff_pay_entries IS
  'Monthly teacher/staff payroll for a department (hours × rate or fixed salary).';
COMMENT ON TABLE public.department_babysitting_income_entries IS
  'Monthly babysitting income for a department (separate from tuition).';
COMMENT ON TABLE public.department_babysitting_pay_entries IS
  'Monthly payments to babysitters for a department.';
