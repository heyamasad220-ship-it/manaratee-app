-- Allow re-registration after cancelled / terminal enrollments
-- Run after scripts/023_register_for_program_charge_ledger.sql
--
-- Fixes:
--   • Terminal statuses (cancelled, withdrawn, etc.) no longer block duplicate checks
--   • Replaces broad UNIQUE(program, participant) indexes with partial indexes
--     that only apply to active enrollments

-- ---------------------------------------------------------------------------
-- 1) Status helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_terminal_enrollment_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(COALESCE(p_status, ''))) IN (
    'cancelled',
    'canceled',
    'withdrawn',
    'transferred',
    'expired',
    'completed'
  );
$$;

CREATE OR REPLACE FUNCTION public.enrollment_status_blocks_duplicate(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT public.is_terminal_enrollment_status(p_status)
    AND lower(btrim(COALESCE(p_status, ''))) IN (
      'pending_payment',
      'pending',
      'enrolled',
      'active'
    );
$$;

-- ---------------------------------------------------------------------------
-- 2) Replace full unique indexes that block re-registration after cancel
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'program_enrollments'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef NOT ILIKE '%WHERE%'
      AND (
        indexdef ILIKE '%participant_contact_id%'
        OR indexdef ILIKE '%child_person_id%'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS program_enrollments_active_participant_uidx
  ON public.program_enrollments (organization_id, program_id, participant_contact_id)
  WHERE participant_contact_id IS NOT NULL
    AND public.enrollment_status_blocks_duplicate(status);

CREATE UNIQUE INDEX IF NOT EXISTS program_enrollments_active_child_person_uidx
  ON public.program_enrollments (organization_id, program_id, child_person_id)
  WHERE child_person_id IS NOT NULL
    AND public.enrollment_status_blocks_duplicate(status);

-- ---------------------------------------------------------------------------
-- 3) Verification
-- ---------------------------------------------------------------------------
SELECT
  to_regprocedure('public.is_terminal_enrollment_status(text)') IS NOT NULL
    AS terminal_helper_exists,
  to_regprocedure('public.enrollment_status_blocks_duplicate(text)') IS NOT NULL
    AS duplicate_helper_exists;
