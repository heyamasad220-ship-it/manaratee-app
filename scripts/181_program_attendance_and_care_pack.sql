-- =============================================================================
-- 181_program_attendance_and_care_pack.sql
-- F4: care_enabled feature pack on offerings
-- F5: program_attendance for teacher class-page marking
--
-- Run in Supabase SQL Editor after 180.
-- =============================================================================

ALTER TABLE public.program_offerings
  ADD COLUMN IF NOT EXISTS care_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.program_offerings.care_enabled IS
  'F4 feature pack: when true, before/after care admin UI is shown for this offering.';
COMMENT ON COLUMN public.program_offerings.attendance_tracked IS
  'F4/F5: when true, teachers can mark attendance on My Classes.';

CREATE TABLE IF NOT EXISTS public.program_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.program_enrollments(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('present', 'absent', 'late', 'excused')
  ),
  marked_by_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (offering_id, enrollment_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS program_attendance_org_offering_date_idx
  ON public.program_attendance(organization_id, offering_id, attendance_date);

CREATE INDEX IF NOT EXISTS program_attendance_enrollment_idx
  ON public.program_attendance(enrollment_id);

ALTER TABLE public.program_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage program attendance"
  ON public.program_attendance;
CREATE POLICY "Org members manage program attendance"
  ON public.program_attendance FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Assigned staff manage offering attendance"
  ON public.program_attendance;
CREATE POLICY "Assigned staff manage offering attendance"
  ON public.program_attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.contacts c
      JOIN public.program_staff_assignments psa
        ON psa.contact_id = c.id
       AND psa.organization_id = c.organization_id
      WHERE c.auth_user_id = auth.uid()
        AND psa.offering_id = program_attendance.offering_id
        AND psa.organization_id = program_attendance.organization_id
        AND psa.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.contacts c
      JOIN public.program_staff_assignments psa
        ON psa.contact_id = c.id
       AND psa.organization_id = c.organization_id
      WHERE c.auth_user_id = auth.uid()
        AND psa.offering_id = program_attendance.offering_id
        AND psa.organization_id = program_attendance.organization_id
        AND psa.is_active = true
    )
  );

-- Verification
SELECT
  COUNT(*) FILTER (WHERE care_enabled IS NOT NULL) AS offerings_with_care_col
FROM public.program_offerings;

SELECT to_regclass('public.program_attendance') AS program_attendance_table;
