-- MAS membership records (distinct from program enrollments and team assignments)
-- Run after 056_rename_hr_module_organization.sql
-- Safe to re-run

CREATE TABLE IF NOT EXISTS public.membership_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_duration_months INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS membership_types_organization_id_idx
  ON public.membership_types(organization_id);

CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  membership_type_id UUID REFERENCES public.membership_types(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'lapsed', 'cancelled')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  renewal_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memberships_organization_id_idx
  ON public.memberships(organization_id);

CREATE INDEX IF NOT EXISTS memberships_contact_id_idx
  ON public.memberships(contact_id);

CREATE INDEX IF NOT EXISTS memberships_org_status_idx
  ON public.memberships(organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active_per_contact_idx
  ON public.memberships(organization_id, contact_id)
  WHERE status = 'active';

COMMENT ON TABLE public.memberships IS
  'Organization membership (dues/benefits). Distinct from program_enrollments (participants) and hr_team_memberships (optional teams).';

COMMENT ON COLUMN public.memberships.end_date IS
  'When membership benefits end. NULL means no fixed end date.';

-- Seed default membership types for every organization
INSERT INTO public.membership_types (organization_id, name, description, default_duration_months, sort_order)
SELECT
  o.id,
  seed.name,
  seed.description,
  seed.default_duration_months,
  seed.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Individual', 'Standard individual membership', 12, 10),
    ('Family', 'Household membership plan', 12, 20),
    ('Student', 'Student / youth membership', 12, 30),
    ('Senior', 'Senior membership', 12, 40),
    ('Lifetime', 'Lifetime membership with no renewal', NULL, 50)
) AS seed(name, description, default_duration_months, sort_order)
ON CONFLICT (organization_id, name) DO NOTHING;

-- Backfill active memberships from legacy member affiliation tag
INSERT INTO public.memberships (
  organization_id,
  contact_id,
  membership_type_id,
  status,
  start_date,
  notes
)
SELECT
  cr.organization_id,
  cr.contact_id,
  mt.id,
  'active',
  COALESCE(c.created_at::date, CURRENT_DATE),
  'Migrated from member affiliation tag'
FROM public.contact_roles cr
JOIN public.contacts c
  ON c.id = cr.contact_id
 AND c.organization_id = cr.organization_id
LEFT JOIN public.membership_types mt
  ON mt.organization_id = cr.organization_id
 AND mt.name = 'Individual'
WHERE cr.role = 'member'
  AND c.contact_type = 'individual'
  AND NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = cr.organization_id
      AND m.contact_id = cr.contact_id
      AND m.status = 'active'
  );

ALTER TABLE public.membership_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view membership types" ON public.membership_types;
CREATE POLICY "Organization members can view membership types"
ON public.membership_types FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can manage membership types" ON public.membership_types;
CREATE POLICY "Organization members can manage membership types"
ON public.membership_types FOR ALL
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

DROP POLICY IF EXISTS "Customers can view membership types" ON public.membership_types;
CREATE POLICY "Customers can view membership types"
ON public.membership_types FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can view memberships" ON public.memberships;
CREATE POLICY "Organization members can view memberships"
ON public.memberships FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can manage memberships" ON public.memberships;
CREATE POLICY "Organization members can manage memberships"
ON public.memberships FOR ALL
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

DROP POLICY IF EXISTS "Customers can view their own memberships" ON public.memberships;
CREATE POLICY "Customers can view their own memberships"
ON public.memberships FOR SELECT
USING (
  contact_id IN (
    SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS membership_types_updated_at ON public.membership_types;
CREATE TRIGGER membership_types_updated_at
  BEFORE UPDATE ON public.membership_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS memberships_updated_at ON public.memberships;
CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
