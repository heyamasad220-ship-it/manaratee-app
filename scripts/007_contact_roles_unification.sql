-- Contacts / HR role unification
-- Run in the Supabase SQL Editor after 005_volunteers.sql and 006_hr_reports.sql.
--
-- Adds employee + member roles, links staff/volunteers to contacts, and backfills data.

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Allow all contact role values (drop legacy check if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contact_roles_role_check'
  ) THEN
    ALTER TABLE public.contact_roles DROP CONSTRAINT contact_roles_role_check;
  END IF;
END $$;

ALTER TABLE public.contact_roles
  DROP CONSTRAINT IF EXISTS contact_roles_role_check;

ALTER TABLE public.contact_roles
  ADD CONSTRAINT contact_roles_role_check
  CHECK (role IN (
    'donor',
    'volunteer',
    'employee',
    'member',
    'vendor',
    'service_provider'
  ));

-- Bridge HR extension tables to contacts
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.volunteers
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_organization_contact_id_idx
  ON public.staff(organization_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS volunteers_organization_contact_id_idx
  ON public.volunteers(organization_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS staff_contact_id_idx
  ON public.staff(contact_id);

CREATE INDEX IF NOT EXISTS volunteers_contact_id_idx
  ON public.volunteers(contact_id);

-- Helper: find or create a contact for an org using email, phone, or name
CREATE OR REPLACE FUNCTION public.find_or_create_contact_for_org(
  p_organization_id UUID,
  p_full_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_contact_type TEXT DEFAULT 'individual'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_contact_id UUID;
  v_clean_email TEXT := NULLIF(LOWER(TRIM(p_email)), '');
  v_clean_phone TEXT := NULLIF(REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_clean_name TEXT := NULLIF(TRIM(p_full_name), '');
BEGIN
  IF v_clean_name IS NULL THEN
    v_clean_name := COALESCE(v_clean_email, v_clean_phone, 'Unnamed Contact');
  END IF;

  IF v_clean_email IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE organization_id = p_organization_id
      AND LOWER(email) = v_clean_email
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL AND v_clean_phone IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE organization_id = p_organization_id
      AND phone = v_clean_phone
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE organization_id = p_organization_id
      AND LOWER(full_name) = LOWER(v_clean_name)
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts (
      organization_id,
      full_name,
      email,
      phone,
      contact_type,
      status
    )
    VALUES (
      p_organization_id,
      v_clean_name,
      v_clean_email,
      v_clean_phone,
      COALESCE(NULLIF(p_contact_type, ''), 'individual'),
      'active'
    )
    RETURNING id INTO v_contact_id;
  END IF;

  RETURN v_contact_id;
END;
$$;

-- Ensure a role row exists
CREATE OR REPLACE FUNCTION public.ensure_contact_role(
  p_organization_id UUID,
  p_contact_id UUID,
  p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.contact_roles (organization_id, contact_id, role)
  VALUES (p_organization_id, p_contact_id, p_role)
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

-- Backfill staff -> contacts + employee role
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
  v_full_name TEXT;
BEGIN
  IF to_regclass('public.staff') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT *
    FROM public.staff
    WHERE contact_id IS NULL
  LOOP
    v_full_name := TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, ''));

    v_contact_id := public.find_or_create_contact_for_org(
      r.organization_id,
      v_full_name,
      r.email,
      r.phone,
      'individual'
    );

    UPDATE public.staff
    SET contact_id = v_contact_id
    WHERE id = r.id;

    PERFORM public.ensure_contact_role(r.organization_id, v_contact_id, 'employee');
  END LOOP;
END $$;

-- Backfill volunteers -> contacts + volunteer role
DO $$
DECLARE
  r RECORD;
  v_contact_id UUID;
  v_full_name TEXT;
BEGIN
  IF to_regclass('public.volunteers') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT *
    FROM public.volunteers
    WHERE contact_id IS NULL
  LOOP
    v_full_name := TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, ''));

    v_contact_id := public.find_or_create_contact_for_org(
      r.organization_id,
      v_full_name,
      r.email,
      r.phone,
      'individual'
    );

    UPDATE public.volunteers
    SET contact_id = v_contact_id
    WHERE id = r.id;

    PERFORM public.ensure_contact_role(r.organization_id, v_contact_id, 'volunteer');
  END LOOP;
END $$;

-- Legacy customer role backfill removed — customer is inferred from transactions, not stored as a role.
