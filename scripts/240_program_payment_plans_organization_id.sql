-- Add organization_id to program_payment_plans (was assumed by app code but missing).
-- Backfills from program_enrollments, then enforces NOT NULL.

ALTER TABLE public.program_payment_plans
  ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE public.program_payment_plans p
SET organization_id = e.organization_id
FROM public.program_enrollments e
WHERE p.enrollment_id = e.id
  AND p.organization_id IS NULL
  AND e.organization_id IS NOT NULL;

DELETE FROM public.program_payment_plans
WHERE organization_id IS NULL;

ALTER TABLE public.program_payment_plans
  ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'program_payment_plans_organization_id_fkey'
  ) THEN
    ALTER TABLE public.program_payment_plans
      ADD CONSTRAINT program_payment_plans_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_program_payment_plans_org_due
  ON public.program_payment_plans (organization_id, due_date);

CREATE INDEX IF NOT EXISTS idx_program_payment_plans_org_enrollment
  ON public.program_payment_plans (organization_id, enrollment_id);
