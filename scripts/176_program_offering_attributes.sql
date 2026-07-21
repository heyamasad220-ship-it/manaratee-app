-- S1: Move operational attributes onto program_offerings (schema + backfill).
-- Program remains identity + optional defaults; offerings become attribute SSOT over phases S2–S4.
-- Run in Supabase SQL Editor AFTER 175_split_customer_programs_affiliation.sql
-- See docs/programs-offering-attributes-migration.md

-- ---------------------------------------------------------------------------
-- 1) Program-level optional default: waitlist offer deadline (days)
-- ---------------------------------------------------------------------------
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS waitlist_offer_deadline_days INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'programs_waitlist_offer_deadline_days_check'
  ) THEN
    ALTER TABLE public.programs
      ADD CONSTRAINT programs_waitlist_offer_deadline_days_check
      CHECK (
        waitlist_offer_deadline_days IS NULL
        OR waitlist_offer_deadline_days >= 1
      );
  END IF;
END $$;

COMMENT ON COLUMN public.programs.waitlist_offer_deadline_days IS
  'Optional default days to accept a waitlist seat offer; new offerings inherit when their own value is null.';

-- ---------------------------------------------------------------------------
-- 2) Offering attribute columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_offerings
  ADD COLUMN IF NOT EXISTS audience_type TEXT,
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  ADD COLUMN IF NOT EXISTS max_age INTEGER,
  ADD COLUMN IF NOT EXISTS min_grade TEXT,
  ADD COLUMN IF NOT EXISTS max_grade TEXT,
  ADD COLUMN IF NOT EXISTS grade_levels TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS require_guardian BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_grade BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_emergency_contact BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS capacity_mode TEXT,
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS enable_waitlist BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waitlist_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS waitlist_offer_deadline_days INTEGER,
  ADD COLUMN IF NOT EXISTS registration_mode TEXT,
  ADD COLUMN IF NOT EXISTS attendance_tracked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_format TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_audience_type_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_audience_type_check
      CHECK (audience_type IS NULL OR audience_type IN ('adult', 'youth'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_min_age_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_min_age_check
      CHECK (min_age IS NULL OR (min_age >= 0 AND min_age <= 120));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_max_age_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_max_age_check
      CHECK (max_age IS NULL OR (max_age >= 0 AND max_age <= 120));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_age_bounds_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_age_bounds_check
      CHECK (
        min_age IS NULL
        OR max_age IS NULL
        OR min_age <= max_age
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_capacity_mode_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_capacity_mode_check
      CHECK (capacity_mode IS NULL OR capacity_mode IN ('unlimited', 'limited'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_capacity_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_capacity_check
      CHECK (capacity IS NULL OR capacity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_waitlist_capacity_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_waitlist_capacity_check
      CHECK (waitlist_capacity IS NULL OR waitlist_capacity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'program_offerings_waitlist_offer_deadline_days_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_waitlist_offer_deadline_days_check
      CHECK (
        waitlist_offer_deadline_days IS NULL
        OR waitlist_offer_deadline_days >= 1
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_registration_mode_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_registration_mode_check
      CHECK (
        registration_mode IS NULL
        OR registration_mode IN ('required', 'optional', 'none')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'program_offerings_delivery_format_check'
  ) THEN
    ALTER TABLE public.program_offerings
      ADD CONSTRAINT program_offerings_delivery_format_check
      CHECK (
        delivery_format IS NULL
        OR delivery_format IN ('in_person', 'online', 'hybrid')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.program_offerings.audience_type IS
  'adult | youth (family mapped to youth on backfill).';
COMMENT ON COLUMN public.program_offerings.capacity_mode IS
  'unlimited | limited. capacity is meaningful when limited.';
COMMENT ON COLUMN public.program_offerings.waitlist_offer_deadline_days IS
  'Days to accept a seat offer; null inherits programs.waitlist_offer_deadline_days.';
COMMENT ON COLUMN public.program_offerings.registration_mode IS
  'required | optional | none.';
COMMENT ON COLUMN public.program_offerings.attendance_tracked IS
  'Whether attendance is tracked for this offering.';
COMMENT ON COLUMN public.program_offerings.delivery_format IS
  'in_person | online | hybrid.';

-- ---------------------------------------------------------------------------
-- 3) Backfill from parent programs
--    family → youth; capacity 0/null → unlimited; registration from flags
-- ---------------------------------------------------------------------------
UPDATE public.program_offerings AS o
SET
  audience_type = CASE
    WHEN COALESCE(p.program_type, 'youth') = 'adult' THEN 'adult'
    ELSE 'youth'
  END,
  min_age = p.min_age,
  max_age = p.max_age,
  min_grade = p.min_grade,
  max_grade = p.max_grade,
  grade_levels = COALESCE(p.grade_levels, '{}'::text[]),
  gender = p.gender,
  require_guardian = COALESCE(p.require_guardian, false),
  require_grade = COALESCE(p.require_grade, false),
  require_emergency_contact = COALESCE(p.require_emergency_contact, true),
  capacity_mode = CASE
    WHEN COALESCE(p.capacity, 0) > 0 THEN 'limited'
    ELSE 'unlimited'
  END,
  capacity = CASE
    WHEN COALESCE(p.capacity, 0) > 0 THEN p.capacity
    ELSE NULL
  END,
  enable_waitlist = COALESCE(p.enable_waitlist, false),
  waitlist_capacity = p.waitlist_capacity,
  waitlist_offer_deadline_days = p.waitlist_offer_deadline_days,
  registration_mode = CASE
    WHEN COALESCE(p.full_program_registration_enabled, false)
      OR COALESCE(p.session_registration_enabled, false)
      THEN 'required'
    ELSE 'none'
  END,
  attendance_tracked = COALESCE(o.attendance_tracked, false),
  delivery_format = COALESCE(o.delivery_format, 'in_person'),
  updated_at = NOW()
FROM public.programs AS p
WHERE o.program_id = p.id
  AND o.organization_id = p.organization_id
  AND o.audience_type IS NULL;

-- Defaults for any leftover nulls (orphan offerings without program match)
UPDATE public.program_offerings
SET
  audience_type = COALESCE(audience_type, 'youth'),
  capacity_mode = COALESCE(capacity_mode, 'unlimited'),
  registration_mode = COALESCE(registration_mode, 'required'),
  delivery_format = COALESCE(delivery_format, 'in_person'),
  attendance_tracked = COALESCE(attendance_tracked, false),
  updated_at = NOW()
WHERE audience_type IS NULL
   OR capacity_mode IS NULL
   OR registration_mode IS NULL
   OR delivery_format IS NULL;

-- ---------------------------------------------------------------------------
-- 4) Smoke checks
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS offerings_total,
  COUNT(*) FILTER (WHERE audience_type IS NOT NULL) AS with_audience,
  COUNT(*) FILTER (WHERE capacity_mode IS NOT NULL) AS with_capacity_mode,
  COUNT(*) FILTER (WHERE registration_mode IS NOT NULL) AS with_registration_mode,
  COUNT(*) FILTER (WHERE delivery_format IS NOT NULL) AS with_delivery
FROM public.program_offerings;
