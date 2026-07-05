-- First-class household records for family giving rollups (donations stay on contacts).
-- Run after 147_venue_rentals_billing_contact_id.sql

CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  primary_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS families_org_status_idx
  ON public.families (organization_id, status);

CREATE INDEX IF NOT EXISTS families_org_primary_contact_idx
  ON public.families (organization_id, primary_contact_id);

COMMENT ON TABLE public.families IS
  'Household container for relationship grouping. Donations remain on individual contacts; family giving is computed.';

CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (
    role IN ('head', 'spouse', 'child', 'parent', 'sibling', 'guardian', 'other', 'member')
  ),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  person_relationship_id UUID REFERENCES public.person_relationships(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_members_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS family_members_org_family_idx
  ON public.family_members (organization_id, family_id);

CREATE INDEX IF NOT EXISTS family_members_org_contact_idx
  ON public.family_members (organization_id, contact_id);

CREATE UNIQUE INDEX IF NOT EXISTS family_members_active_contact_unique
  ON public.family_members (organization_id, contact_id)
  WHERE end_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_members_active_family_contact_unique
  ON public.family_members (family_id, contact_id)
  WHERE end_date IS NULL;

COMMENT ON TABLE public.family_members IS
  'Active household membership by contact. end_date set when a member leaves; gifts stay on the contact.';

DROP TRIGGER IF EXISTS families_updated_at ON public.families;
CREATE TRIGGER families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS family_members_updated_at ON public.family_members;
CREATE TRIGGER family_members_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org families" ON public.families;
CREATE POLICY "Staff view org families"
  ON public.families FOR SELECT
  USING (public.auth_user_can_view_contacts(organization_id));

DROP POLICY IF EXISTS "Staff manage org families" ON public.families;
CREATE POLICY "Staff manage org families"
  ON public.families FOR ALL
  USING (public.auth_user_can_manage_contacts(organization_id))
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff view org family members" ON public.family_members;
CREATE POLICY "Staff view org family members"
  ON public.family_members FOR SELECT
  USING (public.auth_user_can_view_contacts(organization_id));

DROP POLICY IF EXISTS "Staff manage org family members" ON public.family_members;
CREATE POLICY "Staff manage org family members"
  ON public.family_members FOR ALL
  USING (public.auth_user_can_manage_contacts(organization_id))
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.families TO service_role;
GRANT ALL ON public.family_members TO service_role;

-- ---------------------------------------------------------------------------
-- Backfill from person_relationships (one family per primary person_id)
-- ---------------------------------------------------------------------------

INSERT INTO public.families (organization_id, name, status, primary_contact_id)
SELECT DISTINCT ON (pr.organization_id, pr.person_id)
  pr.organization_id,
  COALESCE(NULLIF(btrim(pc.full_name), ''), NULLIF(btrim(CONCAT_WS(' ', pp.first_name, pp.last_name)), ''), 'Household') || ' Family',
  'active',
  pc.id
FROM public.person_relationships pr
INNER JOIN public.people pp ON pp.id = pr.person_id AND pp.organization_id = pr.organization_id
INNER JOIN public.contacts pc
  ON pc.organization_id = pr.organization_id
 AND pc.person_id = pr.person_id
 AND pc.contact_type = 'individual'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.families f
  WHERE f.organization_id = pr.organization_id
    AND f.primary_contact_id = pc.id
)
ORDER BY pr.organization_id, pr.person_id, pc.created_at NULLS LAST;

INSERT INTO public.family_members (
  organization_id,
  family_id,
  contact_id,
  role,
  start_date,
  person_relationship_id
)
SELECT
  f.organization_id,
  f.id,
  f.primary_contact_id,
  'head',
  CURRENT_DATE,
  NULL
FROM public.families f
WHERE f.primary_contact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = f.id
      AND fm.contact_id = f.primary_contact_id
      AND fm.end_date IS NULL
  );

INSERT INTO public.family_members (
  organization_id,
  family_id,
  contact_id,
  role,
  start_date,
  person_relationship_id
)
SELECT
  pr.organization_id,
  f.id,
  mc.id,
  CASE LOWER(COALESCE(pr.relationship_type, 'other'))
    WHEN 'spouse' THEN 'spouse'
    WHEN 'child' THEN 'child'
    WHEN 'parent' THEN 'parent'
    WHEN 'sibling' THEN 'sibling'
    WHEN 'guardian' THEN 'guardian'
    ELSE 'other'
  END,
  CURRENT_DATE,
  pr.id
FROM public.person_relationships pr
INNER JOIN public.families f
  ON f.organization_id = pr.organization_id
INNER JOIN public.contacts pc
  ON pc.organization_id = pr.organization_id
 AND pc.person_id = pr.person_id
 AND pc.id = f.primary_contact_id
INNER JOIN public.contacts mc
  ON mc.organization_id = pr.organization_id
 AND mc.person_id = pr.related_person_id
 AND mc.contact_type = 'individual'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.family_members fm
  WHERE fm.family_id = f.id
    AND fm.contact_id = mc.id
    AND fm.end_date IS NULL
);
