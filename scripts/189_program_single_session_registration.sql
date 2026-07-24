-- Single-session registration flag on programs (and optional offering override inherit).
-- Fixes: Could not find the 'single_session_registration_enabled' column of 'programs'
-- Run in the Supabase SQL Editor.

ALTER TABLE public.programs
ADD COLUMN IF NOT EXISTS single_session_registration_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.programs.single_session_registration_enabled IS
  'When true, customers may register for a single session (distinct from multi-session packs).';

-- Offerings may store an inherited/overridden copy when present on offerings table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'program_offerings'
  ) THEN
    ALTER TABLE public.program_offerings
    ADD COLUMN IF NOT EXISTS single_session_registration_enabled BOOLEAN;

    COMMENT ON COLUMN public.program_offerings.single_session_registration_enabled IS
      'NULL = inherit from program; otherwise offering-level override.';
  END IF;
END $$;
