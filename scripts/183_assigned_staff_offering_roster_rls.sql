-- =============================================================================
-- 183_assigned_staff_offering_roster_rls.sql
-- Allow assigned offering staff (teachers) to read enrollments for their classes.
--
-- Without this, personal-portal users who are NOT organization_members get an
-- empty/error roster on /my-classes/[offeringId] (RLS only allowed org members
-- or the customer's own enrollment rows).
--
-- Run in Supabase SQL Editor after 181 (and 017 enrollment RLS).
-- =============================================================================

DROP POLICY IF EXISTS "Assigned staff view offering enrollments"
  ON public.program_enrollments;
CREATE POLICY "Assigned staff view offering enrollments"
  ON public.program_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.contacts c
      JOIN public.program_staff_assignments psa
        ON psa.contact_id = c.id
       AND psa.organization_id = c.organization_id
      WHERE c.auth_user_id = auth.uid()
        AND psa.offering_id = program_enrollments.offering_id
        AND psa.organization_id = program_enrollments.organization_id
        AND psa.is_active = true
    )
  );

-- Verification
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.program_enrollments'::regclass
  AND polname = 'Assigned staff view offering enrollments';
