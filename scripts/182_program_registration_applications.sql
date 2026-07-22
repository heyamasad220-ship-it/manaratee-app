-- =============================================================================
-- 182_program_registration_applications.sql
-- Registration pipeline v1: program_applications (apply → approve before register)
-- Also: offering_id on program_waitlist for offering-scoped capacity waitlists.
--
-- Run after 180–181. Design: docs/programs-registration-pipeline-design.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  -- Offering after DH "approve other offering" (null = same as offering_id)
  approved_offering_id UUID REFERENCES public.program_offerings(id) ON DELETE SET NULL,
  registrant_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  participant_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  applicant_type TEXT NOT NULL CHECK (applicant_type IN ('returning', 'new')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'approved', 'not_approved', 'withdrawn')
  ),
  source TEXT NOT NULL DEFAULT 'customer' CHECK (source IN ('customer', 'staff')),
  evaluation_notes TEXT,
  evaluated_at TIMESTAMPTZ,
  evaluated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.program_enrollments(id) ON DELETE SET NULL,
  waitlist_id UUID REFERENCES public.program_waitlist(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_applications_org_program_idx
  ON public.program_applications(organization_id, program_id, status);

CREATE INDEX IF NOT EXISTS program_applications_org_offering_idx
  ON public.program_applications(organization_id, offering_id, status);

CREATE INDEX IF NOT EXISTS program_applications_org_participant_idx
  ON public.program_applications(organization_id, participant_contact_id);

CREATE INDEX IF NOT EXISTS program_applications_org_registrant_idx
  ON public.program_applications(organization_id, registrant_contact_id);

COMMENT ON TABLE public.program_applications IS
  'Registration pipeline: apply/approve before fee-creating enrollment. Existing enrollments are treated as already registered.';

ALTER TABLE public.program_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage program applications"
  ON public.program_applications;
CREATE POLICY "Org members manage program applications"
  ON public.program_applications FOR ALL
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

DROP POLICY IF EXISTS "Customers manage own program applications"
  ON public.program_applications;
CREATE POLICY "Customers manage own program applications"
  ON public.program_applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.auth_user_id = auth.uid()
        AND c.organization_id = program_applications.organization_id
        AND (
          c.id = program_applications.registrant_contact_id
          OR c.id = program_applications.participant_contact_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.auth_user_id = auth.uid()
        AND c.organization_id = program_applications.organization_id
        AND (
          c.id = program_applications.registrant_contact_id
          OR c.id = program_applications.participant_contact_id
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Waitlist: offering scope + offer deadline timestamp
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_waitlist
  ADD COLUMN IF NOT EXISTS offering_id UUID REFERENCES public.program_offerings(id) ON DELETE SET NULL;

ALTER TABLE public.program_waitlist
  ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ;

ALTER TABLE public.program_waitlist
  ADD COLUMN IF NOT EXISTS offered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS program_waitlist_org_offering_idx
  ON public.program_waitlist(organization_id, offering_id)
  WHERE offering_id IS NOT NULL;

COMMENT ON COLUMN public.program_waitlist.offering_id IS
  'Offering-scoped waitlist (pipeline). Nullable for legacy program-only rows.';
COMMENT ON COLUMN public.program_waitlist.offer_expires_at IS
  'When status=offered, deadline to accept/register.';

-- Backfill waitlist offering_id to default offering when possible
UPDATE public.program_waitlist w
SET offering_id = o.id
FROM public.program_offerings o
WHERE w.offering_id IS NULL
  AND o.program_id = w.program_id
  AND o.organization_id = w.organization_id
  AND o.is_default = true;

-- Verification
SELECT
  to_regclass('public.program_applications') AS applications_table,
  COUNT(*) FILTER (WHERE offering_id IS NOT NULL) AS waitlist_with_offering
FROM public.program_waitlist;
