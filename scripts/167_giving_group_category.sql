-- Giving group category + optional link to Membership Group (hr_teams) or Department.
-- Badge rule: Membership Group | Department | Group Donation
-- Run in Supabase SQL Editor after 166_group_giving_report.sql

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS giving_group_kind text;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS linked_hr_team_id uuid;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS linked_department_id uuid;

UPDATE public.contacts
SET giving_group_kind = 'group_donation'
WHERE contact_type = 'group'
  AND (giving_group_kind IS NULL OR btrim(giving_group_kind) = '');

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_giving_group_kind_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_giving_group_kind_check
  CHECK (
    giving_group_kind IS NULL
    OR giving_group_kind IN ('membership_group', 'department', 'group_donation')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contacts_linked_hr_team_id_fkey'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_linked_hr_team_id_fkey
      FOREIGN KEY (linked_hr_team_id)
      REFERENCES public.hr_teams (id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contacts_linked_department_id_fkey'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_linked_department_id_fkey
      FOREIGN KEY (linked_department_id)
      REFERENCES public.departments (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contacts_org_giving_group_kind_idx
  ON public.contacts (organization_id, giving_group_kind)
  WHERE contact_type = 'group';

COMMENT ON COLUMN public.contacts.giving_group_kind IS
  'For contact_type=group only: membership_group | department | group_donation. Drives workspace badge.';

COMMENT ON COLUMN public.contacts.linked_hr_team_id IS
  'Optional Membership Group (hr_teams) this giving collective represents.';

COMMENT ON COLUMN public.contacts.linked_department_id IS
  'Optional Department this giving collective represents.';
