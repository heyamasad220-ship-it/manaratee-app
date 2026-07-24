-- Staff-applied financial assistance awards (Mark financial assistance on Payments).
-- Distinct from customer applications in program_financial_assistance.
-- Run after 184_fte_employee_benefit_discount.sql.

CREATE TABLE IF NOT EXISTS public.program_enrollment_fa_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.program_enrollments(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  offering_id UUID REFERENCES public.program_offerings(id) ON DELETE SET NULL,
  participant_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  participant_name TEXT,
  original_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  assisted_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  plan_type TEXT NOT NULL DEFAULT 'total_fee'
    CHECK (plan_type IN ('total_fee', 'monthly')),
  monthly_amount NUMERIC(12,2),
  remaining_months INTEGER,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_enrollment_fa_awards_org_applied_idx
  ON public.program_enrollment_fa_awards (organization_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS program_enrollment_fa_awards_enrollment_idx
  ON public.program_enrollment_fa_awards (organization_id, enrollment_id, status);

CREATE INDEX IF NOT EXISTS program_enrollment_fa_awards_contact_idx
  ON public.program_enrollment_fa_awards (organization_id, participant_contact_id)
  WHERE participant_contact_id IS NOT NULL;

COMMENT ON TABLE public.program_enrollment_fa_awards IS
  'Ledger of staff Mark financial assistance awards: original fee, assisted fee, and plan (total or monthly).';

ALTER TABLE public.program_enrollment_fa_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org staff read FA awards" ON public.program_enrollment_fa_awards;
CREATE POLICY "Org staff read FA awards"
  ON public.program_enrollment_fa_awards
  FOR SELECT
  USING (public.is_org_staff(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Org staff manage FA awards" ON public.program_enrollment_fa_awards;
CREATE POLICY "Org staff manage FA awards"
  ON public.program_enrollment_fa_awards
  FOR ALL
  USING (public.is_org_staff(organization_id, auth.uid()))
  WITH CHECK (public.is_org_staff(organization_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Backfill from enrollment notes written by Mark financial assistance
-- Patterns:
--   Financial assistance: fee set to $X (was $Y).
--   Financial assistance: $A/mo × N mo (fee $X, was $Y).
-- ---------------------------------------------------------------------------
INSERT INTO public.program_enrollment_fa_awards (
  organization_id,
  enrollment_id,
  program_id,
  offering_id,
  participant_contact_id,
  participant_name,
  original_amount,
  assisted_amount,
  discount_amount,
  plan_type,
  monthly_amount,
  remaining_months,
  note,
  status,
  applied_at
)
SELECT
  e.organization_id,
  e.id,
  e.program_id,
  e.offering_id,
  e.participant_contact_id,
  NULLIF(BTRIM(e.child_name), ''),
  COALESCE(
    (regexp_match(
      e.notes,
      'Financial assistance: \$[0-9.]+/mo × [0-9]+ mo \(fee \$[0-9.]+, was \$([0-9.]+)\)',
      'i'
    ))[1]::numeric,
    (regexp_match(
      e.notes,
      'Financial assistance: fee set to \$[0-9.]+ \(was \$([0-9.]+)\)',
      'i'
    ))[1]::numeric,
    0
  ),
  COALESCE(
    (regexp_match(
      e.notes,
      'Financial assistance: \$[0-9.]+/mo × [0-9]+ mo \(fee \$([0-9.]+), was \$[0-9.]+\)',
      'i'
    ))[1]::numeric,
    (regexp_match(
      e.notes,
      'Financial assistance: fee set to \$([0-9.]+) \(was \$[0-9.]+\)',
      'i'
    ))[1]::numeric,
    COALESCE(e.total_amount, 0)
  ),
  GREATEST(
    COALESCE(
      (regexp_match(
        e.notes,
        'Financial assistance: \$[0-9.]+/mo × [0-9]+ mo \(fee \$[0-9.]+, was \$([0-9.]+)\)',
        'i'
      ))[1]::numeric,
      (regexp_match(
        e.notes,
        'Financial assistance: fee set to \$[0-9.]+ \(was \$([0-9.]+)\)',
        'i'
      ))[1]::numeric,
      0
    )
    -
    COALESCE(
      (regexp_match(
        e.notes,
        'Financial assistance: \$[0-9.]+/mo × [0-9]+ mo \(fee \$([0-9.]+), was \$[0-9.]+\)',
        'i'
      ))[1]::numeric,
      (regexp_match(
        e.notes,
        'Financial assistance: fee set to \$([0-9.]+) \(was \$[0-9.]+\)',
        'i'
      ))[1]::numeric,
      COALESCE(e.total_amount, 0)
    ),
    0
  ),
  CASE
    WHEN e.notes ~* 'Financial assistance: \$[0-9.]+/mo × [0-9]+ mo'
      THEN 'monthly'
    ELSE 'total_fee'
  END,
  (regexp_match(
    e.notes,
    'Financial assistance: \$([0-9.]+)/mo × [0-9]+ mo',
    'i'
  ))[1]::numeric,
  (regexp_match(
    e.notes,
    'Financial assistance: \$[0-9.]+/mo × ([0-9]+) mo',
    'i'
  ))[1]::integer,
  'Imported from enrollment notes',
  'active',
  COALESCE(e.updated_at, e.created_at, NOW())
FROM public.program_enrollments e
WHERE e.notes ILIKE '%Financial assistance:%'
  AND (
    e.notes ~* 'Financial assistance: fee set to \$[0-9.]+ \(was \$[0-9.]+\)'
    OR e.notes ~* 'Financial assistance: \$[0-9.]+/mo × [0-9]+ mo \(fee \$[0-9.]+, was \$[0-9.]+\)'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.program_enrollment_fa_awards a
    WHERE a.organization_id = e.organization_id
      AND a.enrollment_id = e.id
      AND a.status = 'active'
  );
