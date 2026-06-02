-- HR Teams, Team Positions, and Team Memberships
-- Run in the Supabase SQL Editor after 009_hr_positions_roles.sql.

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.hr_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS hr_teams_organization_id_idx
  ON public.hr_teams(organization_id);

CREATE INDEX IF NOT EXISTS hr_teams_deleted_at_idx
  ON public.hr_teams(deleted_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hr_team_positions (
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

CREATE INDEX IF NOT EXISTS hr_team_positions_organization_id_idx
  ON public.hr_team_positions(organization_id);

CREATE TABLE IF NOT EXISTS public.hr_team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.hr_teams(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  team_position_id UUID NOT NULL REFERENCES public.hr_team_positions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  start_date DATE,
  end_date DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_team_memberships_organization_id_idx
  ON public.hr_team_memberships(organization_id);

CREATE INDEX IF NOT EXISTS hr_team_memberships_team_id_idx
  ON public.hr_team_memberships(team_id);

CREATE INDEX IF NOT EXISTS hr_team_memberships_contact_id_idx
  ON public.hr_team_memberships(contact_id);

CREATE INDEX IF NOT EXISTS hr_team_memberships_team_position_id_idx
  ON public.hr_team_memberships(team_position_id);

CREATE UNIQUE INDEX IF NOT EXISTS hr_team_memberships_active_unique
  ON public.hr_team_memberships(team_id, contact_id)
  WHERE deleted_at IS NULL AND status = 'active';

ALTER TABLE public.hr_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_team_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_team_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view hr teams"
ON public.hr_teams FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can manage hr teams"
ON public.hr_teams FOR ALL
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

CREATE POLICY "Organization members can view hr team positions"
ON public.hr_team_positions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can manage hr team positions"
ON public.hr_team_positions FOR ALL
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

CREATE POLICY "Organization members can view hr team memberships"
ON public.hr_team_memberships FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can manage hr team memberships"
ON public.hr_team_memberships FOR ALL
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

DROP TRIGGER IF EXISTS hr_teams_updated_at ON public.hr_teams;
CREATE TRIGGER hr_teams_updated_at
  BEFORE UPDATE ON public.hr_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS hr_team_positions_updated_at ON public.hr_team_positions;
CREATE TRIGGER hr_team_positions_updated_at
  BEFORE UPDATE ON public.hr_team_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS hr_team_memberships_updated_at ON public.hr_team_memberships;
CREATE TRIGGER hr_team_memberships_updated_at
  BEFORE UPDATE ON public.hr_team_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed default team positions for every organization
INSERT INTO public.hr_team_positions (organization_id, name, sort_order)
SELECT o.id, pos.name, pos.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Team Leader', 1),
    ('Assistant', 2),
    ('Coordinator', 3),
    ('Member', 4)
) AS pos(name, sort_order)
ON CONFLICT (organization_id, name) DO NOTHING;
