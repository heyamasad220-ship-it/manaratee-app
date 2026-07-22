-- =============================================================================
-- 180_program_offering_inherit_flags.sql
-- F1: Explicit inherit toggles for dates / eligibility / enrollment+waitlist.
--
-- Decisions (programs-flexibility-contract.md):
--   - inherit_* = true  → use program defaults (effective values)
--   - inherit_* = false → use offering-stored values (customized)
--   - Existing offerings backfilled to false (keep current behavior)
--   - New offerings default to true
--
-- Run in Supabase SQL Editor after 176–179.
-- =============================================================================

ALTER TABLE public.program_offerings
  ADD COLUMN IF NOT EXISTS inherit_dates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inherit_eligibility BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inherit_enrollment BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.program_offerings.inherit_dates IS
  'When true, term + enrollment window resolve from the parent program.';
COMMENT ON COLUMN public.program_offerings.inherit_eligibility IS
  'When true, audience/ages/grades/gender/require_* resolve from the parent program.';
COMMENT ON COLUMN public.program_offerings.inherit_enrollment IS
  'When true, waitlist (+ enrollment-type defaults) resolve from the parent program.';

-- Existing offerings: treat as overridden so live data does not change.
UPDATE public.program_offerings
SET
  inherit_dates = false,
  inherit_eligibility = false,
  inherit_enrollment = false;

-- Verification
SELECT
  COUNT(*) AS offerings,
  COUNT(*) FILTER (WHERE inherit_dates = false) AS dates_overridden,
  COUNT(*) FILTER (WHERE inherit_eligibility = false) AS eligibility_overridden,
  COUNT(*) FILTER (WHERE inherit_enrollment = false) AS enrollment_overridden
FROM public.program_offerings;
