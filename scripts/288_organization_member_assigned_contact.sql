-- Org-owned work logins (Settings → Users) can be assigned to a Directory person
-- and later transferred. Personal email stays on contacts.email.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS assigned_contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organization_members.assigned_contact_id IS
  'Directory person currently holding this staff login / work email. Transferable.';

CREATE INDEX IF NOT EXISTS organization_members_assigned_contact_idx
  ON public.organization_members (organization_id, assigned_contact_id)
  WHERE assigned_contact_id IS NOT NULL;

-- One Directory person holds at most one staff work login in an organization.
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_one_assigned_contact_per_org
  ON public.organization_members (organization_id, assigned_contact_id)
  WHERE assigned_contact_id IS NOT NULL
    AND COALESCE(platform_support_access, false) = false;

CREATE OR REPLACE FUNCTION public.organization_members_assigned_contact_same_org()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  contact_org uuid;
BEGIN
  IF NEW.assigned_contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO contact_org
  FROM public.contacts
  WHERE id = NEW.assigned_contact_id;

  IF contact_org IS NULL THEN
    RAISE EXCEPTION 'Assigned contact was not found.';
  END IF;

  IF contact_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Work email must be assigned to a person in the same organization.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_members_assigned_contact_same_org
  ON public.organization_members;

CREATE TRIGGER organization_members_assigned_contact_same_org
  BEFORE INSERT OR UPDATE OF assigned_contact_id
  ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.organization_members_assigned_contact_same_org();

NOTIFY pgrst, 'reload schema';
