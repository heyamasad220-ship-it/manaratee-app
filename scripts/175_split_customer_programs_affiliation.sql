-- Split unified customer: restore program_participant (Programs) for enrollments;
-- keep customer for events/ticketing and venue rentals only.
-- Run after 174_enrollment_unique_per_offering.sql

-- ---------------------------------------------------------------------------
-- contact_roles.role CHECK — allow program_participant again
-- ---------------------------------------------------------------------------
ALTER TABLE public.contact_roles
  DROP CONSTRAINT IF EXISTS contact_roles_role_check;

ALTER TABLE public.contact_roles
  ADD CONSTRAINT contact_roles_role_check
  CHECK (role IN (
    'donor',
    'customer',
    'program_participant',
    'volunteer',
    'employee',
    'member',
    'vendor',
    'service_provider',
    'childcare_provider'
  ));

COMMENT ON TABLE public.contact_roles IS
  'Contact roles. Derived roles sync from module activity; staff may override manual labels (is_manual). Sticky: donor, volunteer, vendor, customer, program_participant.';

-- ---------------------------------------------------------------------------
-- organization_affiliation_settings.role CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_affiliation_settings
  DROP CONSTRAINT IF EXISTS organization_affiliation_settings_role_check;

ALTER TABLE public.organization_affiliation_settings
  ADD CONSTRAINT organization_affiliation_settings_role_check
  CHECK (role IN (
    'donor',
    'volunteer',
    'employee',
    'member',
    'vendor',
    'childcare_provider',
    'customer',
    'program_participant'
  ));

-- Seed program_participant settings from existing customer toggle when present
INSERT INTO public.organization_affiliation_settings (organization_id, role, auto_sync_enabled)
SELECT oas.organization_id, 'program_participant', oas.auto_sync_enabled
FROM public.organization_affiliation_settings oas
WHERE oas.role = 'customer'
ON CONFLICT (organization_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Default auto-sync: Programs vs Customer (events + venue)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_affiliation_default_auto_sync_enabled(
  p_organization_id uuid,
  p_role text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  CASE p_role
    WHEN 'donor' THEN
      RETURN public.org_has_any_module_slug(p_organization_id, ARRAY['donations']);
    WHEN 'vendor' THEN
      RETURN public.org_has_any_module_slug(p_organization_id, ARRAY['vendor-hub', 'bazaar']);
    WHEN 'childcare_provider' THEN
      RETURN public.org_has_any_module_slug(
        p_organization_id,
        ARRAY['workforce', 'child-care', 'applications', 'hr']
      );
    WHEN 'volunteer' THEN
      RETURN public.org_has_any_module_slug(p_organization_id, ARRAY['workforce', 'hr']);
    WHEN 'employee' THEN
      RETURN public.org_has_any_module_slug(p_organization_id, ARRAY['workforce', 'hr']);
    WHEN 'member' THEN
      RETURN public.org_has_any_module_slug(p_organization_id, ARRAY['membership']);
    WHEN 'program_participant' THEN
      RETURN public.org_has_any_module_slug(p_organization_id, ARRAY['programs']);
    WHEN 'customer' THEN
      RETURN public.org_has_any_module_slug(
        p_organization_id,
        ARRAY['event-management', 'ticketing', 'bookings']
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- ---------------------------------------------------------------------------
-- sync_contact_affiliations — split Programs vs Customer
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
     AND d.organization_id = p.organization_id
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
     AND (
       EXISTS (
         SELECT 1 FROM public.applications a
         WHERE a.organization_id = p_organization_id
           AND a.contact_id = p_contact_id
           AND a.application_type = 'vendor'
           AND a.status = 'approved'
       )
       OR EXISTS (
         SELECT 1 FROM public.vendors v
         WHERE v.organization_id = p_organization_id
           AND v.contact_id = p_contact_id
       )
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

  -- Programs: participant or registrant (parents of minors)
  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'program_participant')
     AND EXISTS (
       SELECT 1 FROM public.program_enrollments e
       WHERE e.organization_id = p_organization_id
         AND e.status NOT IN ('cancelled', 'withdrawn', 'transferred')
         AND (
           e.participant_contact_id = p_contact_id
           OR e.registrant_contact_id = p_contact_id
         )
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'program_participant');
  END IF;

  -- Customer: events/ticketing + venue rentals only
  IF public.org_affiliation_auto_sync_enabled(p_organization_id, 'customer')
     AND (
       EXISTS (
         SELECT 1 FROM public.ticket_orders t
         WHERE t.organization_id = p_organization_id
           AND t.contact_id = p_contact_id
           AND t.status = 'completed'
       )
       OR EXISTS (
         SELECT 1 FROM public.venue_rentals vr
         WHERE vr.organization_id = p_organization_id
           AND vr.billing_contact_id = p_contact_id
           AND vr.status NOT IN (
             'draft',
             'declined',
             'hold_expired',
             'cancelled_before_payment',
             'cancelled_after_payment'
           )
       )
     ) THEN
    v_derived_roles := array_append(v_derived_roles, 'customer');
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

COMMENT ON FUNCTION public.sync_contact_affiliations IS
  'SECURITY DEFINER: reconcile derived contact_roles. program_participant = Programs enrollments (participant or registrant); customer = events/ticketing + venue rentals (175).';

-- ---------------------------------------------------------------------------
-- Backfill: Programs tag for participants + registrants
-- ---------------------------------------------------------------------------
INSERT INTO public.contact_roles (organization_id, contact_id, role, is_manual)
SELECT DISTINCT e.organization_id, e.participant_contact_id, 'program_participant', false
FROM public.program_enrollments e
WHERE e.participant_contact_id IS NOT NULL
  AND e.status NOT IN ('cancelled', 'withdrawn', 'transferred')
ON CONFLICT DO NOTHING;

INSERT INTO public.contact_roles (organization_id, contact_id, role, is_manual)
SELECT DISTINCT e.organization_id, e.registrant_contact_id, 'program_participant', false
FROM public.program_enrollments e
WHERE e.registrant_contact_id IS NOT NULL
  AND e.status NOT IN ('cancelled', 'withdrawn', 'transferred')
ON CONFLICT DO NOTHING;

-- Strip sticky customer that was only from programs (no ticket / venue activity)
DELETE FROM public.contact_roles cr
WHERE cr.role = 'customer'
  AND COALESCE(cr.is_manual, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_orders t
    WHERE t.organization_id = cr.organization_id
      AND t.contact_id = cr.contact_id
      AND t.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.venue_rentals vr
    WHERE vr.organization_id = cr.organization_id
      AND vr.billing_contact_id = cr.contact_id
      AND vr.status NOT IN (
        'draft',
        'declined',
        'hold_expired',
        'cancelled_before_payment',
        'cancelled_after_payment'
      )
  );
