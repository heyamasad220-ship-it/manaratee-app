-- HR Reports: attendance, time off, and staff department linkage
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS staff_department_id_idx
  ON public.staff(department_id);

CREATE TABLE IF NOT EXISTS public.hr_attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, record_date)
);

CREATE INDEX IF NOT EXISTS hr_attendance_records_organization_id_idx
  ON public.hr_attendance_records(organization_id);

CREATE INDEX IF NOT EXISTS hr_attendance_records_record_date_idx
  ON public.hr_attendance_records(organization_id, record_date);

CREATE TABLE IF NOT EXISTS public.hr_time_off_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'vacation'
    CHECK (leave_type IN ('vacation', 'sick', 'personal', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(6, 2) NOT NULL DEFAULT 1 CHECK (days_count > 0),
  status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved', 'pending', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS hr_time_off_records_organization_id_idx
  ON public.hr_time_off_records(organization_id);

CREATE INDEX IF NOT EXISTS hr_time_off_records_start_date_idx
  ON public.hr_time_off_records(organization_id, start_date);

ALTER TABLE public.hr_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_time_off_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view hr attendance records"
ON public.hr_attendance_records
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can insert hr attendance records"
ON public.hr_attendance_records
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update hr attendance records"
ON public.hr_attendance_records
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can delete hr attendance records"
ON public.hr_attendance_records
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can view hr time off records"
ON public.hr_time_off_records
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can insert hr time off records"
ON public.hr_time_off_records
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update hr time off records"
ON public.hr_time_off_records
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can delete hr time off records"
ON public.hr_time_off_records
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hr_attendance_records_updated_at ON public.hr_attendance_records;
CREATE TRIGGER hr_attendance_records_updated_at
  BEFORE UPDATE ON public.hr_attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS hr_time_off_records_updated_at ON public.hr_time_off_records;
CREATE TRIGGER hr_time_off_records_updated_at
  BEFORE UPDATE ON public.hr_time_off_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
