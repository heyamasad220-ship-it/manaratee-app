-- Organization entitlement: which program modes this tenant may create.
-- academic | seasonal | both (default). Safe to re-run.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS program_kinds text NOT NULL DEFAULT 'both';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_program_kinds_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_program_kinds_check
      CHECK (program_kinds IN ('academic', 'seasonal', 'both'));
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.program_kinds IS
  'SaaS packaging: academic-only, seasonal-only, or both program modes. Default both.';
