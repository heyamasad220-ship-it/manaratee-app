-- Patch sync_contact_affiliations: group contacts create organization-type donor rows.
-- Run after 132_contact_type_group.sql (requires 115 applied).

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
  v_ensure_donor_extension boolean := false;
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

  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'member')
     AND EXISTS (
       SELECT 1 FROM public.memberships m
       WHERE m.organization_id = p_organization_id
         AND m.contact_id = p_contact_id
         AND m.status = 'active'
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'member');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.organization_id = p_organization_id
      AND p.contact_id = p_contact_id
  ) OR EXISTS (
    SELECT 1
    FROM public.payments p
    INNER JOIN public.donors d
      ON d.id = p.donor_id
     AND d.organization_id = p_organization_id
    WHERE p.organization_id = p_organization_id
      AND d.contact_id = p_contact_id
  ) THEN
    v_ensure_donor_extension := true;
    IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'donor') THEN
      v_derived_roles := array_append(v_derived_roles, 'donor');
    END IF;
  END IF;

  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'volunteer')
     AND EXISTS (
       SELECT 1 FROM public.volunteers vol
       WHERE vol.organization_id = p_organization_id AND vol.contact_id = p_contact_id
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'volunteer');
  END IF;

  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'employee')
     AND EXISTS (
       SELECT 1 FROM public.staff s
       WHERE s.organization_id = p_organization_id
         AND s.contact_id = p_contact_id
         AND s.status = 'active'
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'employee');
  END IF;

  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'vendor')
     AND EXISTS (
       SELECT 1 FROM public.applications a
       WHERE a.organization_id = p_organization_id
         AND a.contact_id = p_contact_id
         AND a.application_type = 'vendor'
         AND a.status = 'approved'
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'vendor');
  END IF;

  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'childcare_provider')
     AND EXISTS (
       SELECT 1 FROM public.applications a
       WHERE a.organization_id = p_organization_id
         AND a.contact_id = p_contact_id
         AND a.application_type = 'childcare_provider'
         AND a.status = 'approved'
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'childcare_provider');
  END IF;

  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'program_participant')
     AND EXISTS (
       SELECT 1 FROM public.program_enrollments e
       WHERE e.organization_id = p_organization_id
         AND e.participant_contact_id = p_contact_id
         AND e.status NOT IN ('cancelled', 'withdrawn', 'transferred')
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'program_participant');
  END IF;

  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'event_attendee')
     AND EXISTS (
       SELECT 1 FROM public.ticket_orders t
       WHERE t.organization_id = p_organization_id
         AND t.contact_id = p_contact_id
         AND t.status = 'completed'
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'event_attendee');
  END IF;

  IF v_ensure_donor_extension THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.donors d
      WHERE d.organization_id = p_organization_id AND d.contact_id = p_contact_id
    ) THEN
      SELECT
        full_name,
        email,
        phone,
        CASE
          WHEN contact_type IN ('organization', 'group') THEN 'organization'
          ELSE 'individual'
        END
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
