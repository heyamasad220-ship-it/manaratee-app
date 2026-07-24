-- Department-scoped program settings + department-wide promo codes.
-- Run in the Supabase SQL Editor after 189_program_single_session_registration.sql.

-- ---------------------------------------------------------------------------
-- 1. department_program_settings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.department_program_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT department_program_settings_org_dept_unique
    UNIQUE (organization_id, department_id)
);

CREATE INDEX IF NOT EXISTS department_program_settings_department_id_idx
  ON public.department_program_settings (department_id);

CREATE INDEX IF NOT EXISTS department_program_settings_organization_id_idx
  ON public.department_program_settings (organization_id);

ALTER TABLE public.department_program_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'department_program_settings'
      AND policyname = 'department_program_settings_org_access'
  ) THEN
    CREATE POLICY department_program_settings_org_access
      ON public.department_program_settings
      FOR ALL
      USING (
        organization_id IN (
          SELECT om.organization_id
          FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT om.organization_id
          FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. discount_codes — department-scoped promo codes
-- ---------------------------------------------------------------------------

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments (id) ON DELETE CASCADE;

-- Allow program_id to be NULL for department-wide codes (and any legacy ticket rows).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'discount_codes'
      AND column_name = 'program_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.discount_codes
      ALTER COLUMN program_id DROP NOT NULL;
  END IF;
END $$;

-- Backfill department_id from the linked program year/season.
UPDATE public.discount_codes dc
SET department_id = p.department_id
FROM public.programs p
WHERE dc.program_id = p.id
  AND dc.department_id IS NULL
  AND p.department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS discount_codes_department_id_idx
  ON public.discount_codes (department_id);

CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_department_code_idx
  ON public.discount_codes (department_id, lower(code))
  WHERE department_id IS NOT NULL;

-- Keep legacy program-scoped uniqueness for rows that still have program_id.
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_program_code_idx
  ON public.discount_codes (program_id, lower(code))
  WHERE program_id IS NOT NULL;

COMMENT ON COLUMN public.discount_codes.department_id IS
  'When set, promo code applies across all years/offerings in the department. program_id may be NULL.';
