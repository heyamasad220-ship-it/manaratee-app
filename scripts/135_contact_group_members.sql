-- Group membership: link individuals to group contacts (primary collective identity).
-- Run after 132_contact_type_group.sql

CREATE TABLE IF NOT EXISTS public.contact_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  member_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contact_group_members_distinct CHECK (group_contact_id <> member_contact_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_group_members_active_unique
  ON public.contact_group_members (group_contact_id, member_contact_id);

CREATE INDEX IF NOT EXISTS contact_group_members_org_group_idx
  ON public.contact_group_members (organization_id, group_contact_id);

CREATE INDEX IF NOT EXISTS contact_group_members_org_member_idx
  ON public.contact_group_members (organization_id, member_contact_id);

COMMENT ON TABLE public.contact_group_members IS
  'Individuals belonging to a group contact. Group gifts stay on the group; member gifts stay on the person.';

DROP TRIGGER IF EXISTS contact_group_members_updated_at ON public.contact_group_members;
CREATE TRIGGER contact_group_members_updated_at
  BEFORE UPDATE ON public.contact_group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.contact_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org contact group members" ON public.contact_group_members;
CREATE POLICY "Staff view org contact group members"
  ON public.contact_group_members FOR SELECT
  USING (public.auth_user_can_view_contacts(organization_id));

DROP POLICY IF EXISTS "Staff insert org contact group members" ON public.contact_group_members;
CREATE POLICY "Staff insert org contact group members"
  ON public.contact_group_members FOR INSERT
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff update org contact group members" ON public.contact_group_members;
CREATE POLICY "Staff update org contact group members"
  ON public.contact_group_members FOR UPDATE
  USING (public.auth_user_can_manage_contacts(organization_id))
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff delete org contact group members" ON public.contact_group_members;
CREATE POLICY "Staff delete org contact group members"
  ON public.contact_group_members FOR DELETE
  USING (public.auth_user_can_manage_contacts(organization_id));
