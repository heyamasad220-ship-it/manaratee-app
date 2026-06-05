-- Program staff assignments: link contacts (employees/volunteers) to offerings/sessions
-- Run in Supabase SQL Editor after 030_program_branding_colors.sql

CREATE TABLE IF NOT EXISTS public.program_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.program_sessions(id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL CHECK (
    assignment_role IN (
      'primary_instructor',
      'assistant_instructor',
      'substitute',
      'volunteer',
      'coordinator'
    )
  ),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (session_id IS NULL OR offering_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS program_staff_assignments_org_program_idx
  ON public.program_staff_assignments(organization_id, program_id);

CREATE INDEX IF NOT EXISTS program_staff_assignments_org_offering_idx
  ON public.program_staff_assignments(organization_id, offering_id);

CREATE INDEX IF NOT EXISTS program_staff_assignments_org_session_idx
  ON public.program_staff_assignments(organization_id, session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS program_staff_assignments_org_contact_idx
  ON public.program_staff_assignments(organization_id, contact_id);

CREATE UNIQUE INDEX IF NOT EXISTS program_staff_assignments_active_unique
  ON public.program_staff_assignments(
    organization_id,
    contact_id,
    offering_id,
    COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid),
    assignment_role
  )
  WHERE is_active = true;

ALTER TABLE public.program_staff_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage program staff assignments"
  ON public.program_staff_assignments;
CREATE POLICY "Org members manage program staff assignments"
  ON public.program_staff_assignments FOR ALL
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

DROP POLICY IF EXISTS "Assigned contacts view own program staff assignments"
  ON public.program_staff_assignments;
CREATE POLICY "Assigned contacts view own program staff assignments"
  ON public.program_staff_assignments FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts
      WHERE auth_user_id = auth.uid()
        AND organization_id = program_staff_assignments.organization_id
    )
  );
