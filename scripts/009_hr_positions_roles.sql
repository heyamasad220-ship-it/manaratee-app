-- HR Positions and Job Roles
-- Run in the Supabase SQL Editor after 006_hr_reports.sql.

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.hr_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS hr_positions_organization_id_idx
  ON public.hr_positions(organization_id);

CREATE TABLE IF NOT EXISTS public.hr_job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS hr_job_roles_organization_id_idx
  ON public.hr_job_roles(organization_id);

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.hr_positions(id) ON DELETE SET NULL;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS hr_job_role_id UUID REFERENCES public.hr_job_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS staff_position_id_idx
  ON public.staff(position_id);

CREATE INDEX IF NOT EXISTS staff_hr_job_role_id_idx
  ON public.staff(hr_job_role_id);

ALTER TABLE public.hr_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_job_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view hr positions"
ON public.hr_positions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can manage hr positions"
ON public.hr_positions FOR ALL
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

CREATE POLICY "Organization members can view hr job roles"
ON public.hr_job_roles FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can manage hr job roles"
ON public.hr_job_roles FOR ALL
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

DROP TRIGGER IF EXISTS hr_positions_updated_at ON public.hr_positions;
CREATE TRIGGER hr_positions_updated_at
  BEFORE UPDATE ON public.hr_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS hr_job_roles_updated_at ON public.hr_job_roles;
CREATE TRIGGER hr_job_roles_updated_at
  BEFORE UPDATE ON public.hr_job_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed positions from legacy free-text staff.position values
INSERT INTO public.hr_positions (organization_id, name)
SELECT DISTINCT s.organization_id, TRIM(s.position)
FROM public.staff s
WHERE s.position IS NOT NULL
  AND TRIM(s.position) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.hr_positions hp
    WHERE hp.organization_id = s.organization_id
      AND LOWER(hp.name) = LOWER(TRIM(s.position))
  );

UPDATE public.staff s
SET position_id = hp.id
FROM public.hr_positions hp
WHERE s.position_id IS NULL
  AND s.position IS NOT NULL
  AND TRIM(s.position) <> ''
  AND hp.organization_id = s.organization_id
  AND LOWER(hp.name) = LOWER(TRIM(s.position));
