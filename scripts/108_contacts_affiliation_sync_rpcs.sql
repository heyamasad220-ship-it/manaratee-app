-- Contacts affiliation sync + gated contact creation (M6).
-- Run after 107_contacts_permission_seeds.sql
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Promote find_or_create_contact_for_org to SECURITY DEFINER with module gate
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_or_create_contact_for_org(
  p_organization_id uuid,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_contact_type text DEFAULT 'individual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_clean_email text := NULLIF(LOWER(TRIM(p_email)), '');
  v_clean_phone text := NULLIF(REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_clean_name text := NULLIF(TRIM(p_full_name), '');
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.auth_user_may_create_contact_via_module(p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to create contacts in this organization';
  END IF;

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

-- ---------------------------------------------------------------------------
-- ensure_contact_for_person (customer family + program backfill)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_contact_for_person(
  p_organization_id uuid,
  p_person_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_full_name text;
  v_email text;
  v_phone text;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.auth_user_may_ensure_contact_for_person(p_organization_id, p_person_id) THEN
    RAISE EXCEPTION 'Not authorized to ensure contact for this person';
  END IF;

  SELECT id INTO v_contact_id
  FROM public.contacts
  WHERE organization_id = p_organization_id
    AND person_id = p_person_id
  LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    RETURN v_contact_id;
  END IF;

  SELECT
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
    email,
    phone
  INTO v_full_name, v_email, v_phone
  FROM public.people
  WHERE id = p_person_id
    AND organization_id = p_organization_id;

  IF v_full_name IS NULL THEN
    RAISE EXCEPTION 'Person not found';
  END IF;

  IF v_full_name = '' THEN
    v_full_name := 'Family Member';
  END IF;

  INSERT INTO public.contacts (
    organization_id,
    full_name,
    person_id,
    email,
    phone,
    contact_type,
    status
  )
  VALUES (
    p_organization_id,
    v_full_name,
    p_person_id,
    v_email,
    v_phone,
    'individual',
    'active'
  )
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- sync_contact_affiliations — derive + reconcile contact_roles (authoritative)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_contact_affiliations(
  p_organization_id uuid,
  p_contact_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row record;
  v_has_donor boolean := false;
  v_donor_type text;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_derived_roles text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = p_contact_id AND c.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Contact not found in organization';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.auth_user_may_sync_derived_affiliations(p_organization_id, p_contact_id) THEN
    RAISE EXCEPTION 'Not authorized to sync contact affiliations';
  END IF;

  -- member
  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.organization_id = p_organization_id
      AND m.contact_id = p_contact_id
      AND m.status = 'active'
  ) THEN
    v_derived_roles := array_append(v_derived_roles, 'member');
  END IF;

  -- donor
  IF EXISTS (
    SELECT 1 FROM public.donors d
    WHERE d.organization_id = p_organization_id AND d.contact_id = p_contact_id
  ) OR EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.organization_id = p_organization_id AND p.contact_id = p_contact_id
  ) OR EXISTS (
    SELECT 1
    FROM public.payments p
    INNER JOIN public.donors d
      ON d.id = p.donor_id
     AND d.organization_id = p_organization_id
    WHERE p.organization_id = p_organization_id
      AND d.contact_id = p_contact_id
  ) THEN
    v_derived_roles := array_append(v_derived_roles, 'donor');
    v_has_donor := true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.volunteers v
    WHERE v.organization_id = p_organization_id AND v.contact_id = p_contact_id
  ) THEN
    v_derived_roles := array_append(v_derived_roles, 'volunteer');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.organization_id = p_organization_id
      AND s.contact_id = p_contact_id
      AND s.status = 'active'
  ) THEN
    v_derived_roles := array_append(v_derived_roles, 'employee');
  END IF;

  -- Vendor: approved applications only (public.vendors has no contact_id)
  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.organization_id = p_organization_id
      AND a.contact_id = p_contact_id
      AND a.application_type = 'vendor'
      AND a.status = 'approved'
  ) THEN
    v_derived_roles := array_append(v_derived_roles, 'vendor');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.organization_id = p_organization_id
      AND a.contact_id = p_contact_id
      AND a.application_type = 'childcare_provider'
      AND a.status = 'approved'
  ) THEN
    v_derived_roles := array_append(v_derived_roles, 'childcare_provider');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.participant_contact_id = p_contact_id
      AND e.status NOT IN ('cancelled', 'withdrawn', 'transferred')
  ) THEN
    v_derived_roles := array_append(v_derived_roles, 'program_participant');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ticket_orders t
    WHERE t.organization_id = p_organization_id
      AND t.contact_id = p_contact_id
      AND t.status = 'completed'
  ) THEN
    v_derived_roles := array_append(v_derived_roles, 'event_attendee');
  END IF;

  IF v_has_donor THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.donors d
      WHERE d.organization_id = p_organization_id AND d.contact_id = p_contact_id
    ) THEN
      SELECT
        full_name,
        email,
        phone,
        CASE WHEN contact_type = 'organization' THEN 'organization' ELSE 'individual' END
      INTO v_contact_name, v_contact_email, v_contact_phone, v_donor_type
      FROM public.contacts
      WHERE id = p_contact_id AND organization_id = p_organization_id;

      INSERT INTO public.donors (
        organization_id,
        contact_id,
        full_name,
        email,
        phone,
        donor_type,
        status
      )
      VALUES (
        p_organization_id,
        p_contact_id,
        COALESCE(v_contact_name, 'Unnamed'),
        v_contact_email,
        v_contact_phone,
        COALESCE(v_donor_type, 'individual'),
        'active'
      )
      ON CONFLICT (organization_id, contact_id) DO NOTHING;
    END IF;
  END IF;

  FOREACH v_role IN ARRAY v_derived_roles LOOP
    INSERT INTO public.contact_roles (organization_id, contact_id, role, is_manual)
    VALUES (p_organization_id, p_contact_id, v_role, false)
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR v_row IN
    SELECT cr.id, cr.role, cr.is_manual
    FROM public.contact_roles cr
    WHERE cr.organization_id = p_organization_id
      AND cr.contact_id = p_contact_id
  LOOP
    IF COALESCE(v_row.is_manual, false) THEN
      CONTINUE;
    END IF;

    IF v_row.role IN ('employee', 'member', 'childcare_provider')
       AND NOT (v_row.role = ANY (v_derived_roles)) THEN
      DELETE FROM public.contact_roles WHERE id = v_row.id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_contact_affiliations(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_contact_affiliations(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_contact_affiliations(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ensure_contact_for_person(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_contact_for_person(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_contact_for_person(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.sync_contact_affiliations IS
  'SECURITY DEFINER: reconcile derived contact_roles from module activity. Gate: may_sync_derived_affiliations or service role.';

COMMENT ON FUNCTION public.ensure_contact_for_person IS
  'SECURITY DEFINER: link or create a contact for a person record (family/program paths).';

COMMENT ON FUNCTION public.find_or_create_contact_for_org IS
  'SECURITY DEFINER: find or create org contact. Gate: contacts.manage or module create permission.';
