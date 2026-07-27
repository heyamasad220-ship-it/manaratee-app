-- Household members: adults (contacts) + minors (people without contact profiles).
-- Run after 148_families_and_family_members.sql (and ideally 195).
--
-- Model:
--   • contact_id — optional; set for adults who have a CRM profile
--   • person_id — preferred identity; required for person-only minors
--   • At least one of contact_id / person_id must be set
--   • One active household per person (and per contact when present)

ALTER TABLE public.family_members
  ALTER COLUMN contact_id DROP NOT NULL;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.people(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.family_members.person_id IS
  'Canonical household member identity. Minors use person_id only (no contact profile).';

COMMENT ON COLUMN public.family_members.contact_id IS
  'Optional CRM contact for adults. Null for person-only minors.';

COMMENT ON TABLE public.family_members IS
  'Household membership: adults (contact + person) and minors (person only). Soft end_date when leaving.';

-- Backfill person_id from linked contacts
UPDATE public.family_members fm
SET person_id = c.person_id
FROM public.contacts c
WHERE fm.contact_id = c.id
  AND fm.person_id IS NULL
  AND c.person_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'family_members_identity_check'
  ) THEN
    ALTER TABLE public.family_members
      ADD CONSTRAINT family_members_identity_check
      CHECK (contact_id IS NOT NULL OR person_id IS NOT NULL);
  END IF;
END $$;

DROP INDEX IF EXISTS public.family_members_active_contact_unique;
DROP INDEX IF EXISTS public.family_members_active_family_contact_unique;

CREATE UNIQUE INDEX IF NOT EXISTS family_members_active_contact_unique
  ON public.family_members (organization_id, contact_id)
  WHERE end_date IS NULL AND contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_members_active_person_unique
  ON public.family_members (organization_id, person_id)
  WHERE end_date IS NULL AND person_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_members_active_family_contact_unique
  ON public.family_members (family_id, contact_id)
  WHERE end_date IS NULL AND contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_members_active_family_person_unique
  ON public.family_members (family_id, person_id)
  WHERE end_date IS NULL AND person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS family_members_org_person_idx
  ON public.family_members (organization_id, person_id);
