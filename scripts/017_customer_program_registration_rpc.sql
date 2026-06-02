-- P0: Secure customer program registration via SECURITY DEFINER RPC
-- Run in Supabase SQL Editor after 016_program_registration_contacts_phase0_1.sql

-- ---------------------------------------------------------------------------
-- 1) Customer read access for offerings / options (via contacts.auth_user_id)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers view program offerings" ON public.program_offerings;
CREATE POLICY "Customers view program offerings"
  ON public.program_offerings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers view program registration options" ON public.program_registration_options;
CREATE POLICY "Customers view program registration options"
  ON public.program_registration_options FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Staff-only direct writes on enrollments + session access (customers use RPC)
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage program enrollments" ON public.program_enrollments;
CREATE POLICY "Org members manage program enrollments"
  ON public.program_enrollments FOR ALL
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

DROP POLICY IF EXISTS "Customers view own program enrollments" ON public.program_enrollments;
CREATE POLICY "Customers view own program enrollments"
  ON public.program_enrollments FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
    AND (
      registrant_contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
      OR participant_contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Session access: customers read own rows; staff manage all (016 policy remains)
DROP POLICY IF EXISTS "Customers view own program registration session access" ON public.program_registration_session_access;
CREATE POLICY "Customers view own program registration session access"
  ON public.program_registration_session_access FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
    AND enrollment_id IN (
      SELECT e.id
      FROM public.program_enrollments e
      WHERE e.registrant_contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
      OR e.participant_contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_has_org_access(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.auth_user_id = auth.uid()
      AND c.organization_id = p_organization_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_organization_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_customer_contact(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  person_id uuid,
  full_name text,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.person_id, c.full_name, c.email, c.phone
  FROM public.contacts c
  WHERE c.auth_user_id = auth.uid()
    AND c.organization_id = p_organization_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_registrant_family_participant(
  p_organization_id uuid,
  p_registrant_person_id uuid,
  p_participant_contact_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts pc
    INNER JOIN public.person_relationships pr
      ON pr.related_person_id = pc.person_id
     AND pr.organization_id = p_organization_id
     AND pr.person_id = p_registrant_person_id
    WHERE pc.id = p_participant_contact_id
      AND pc.organization_id = p_organization_id
  );
$$;

-- ---------------------------------------------------------------------------
-- 4) Atomic customer registration RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_for_program(
  p_organization_id uuid,
  p_program_id uuid,
  p_registration_option_id uuid,
  p_participant_contact_id uuid,
  p_session_ids uuid[],
  p_mode text,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_notes text,
  p_before_care boolean,
  p_after_care boolean,
  p_lunch_type text,
  p_total_amount numeric,
  p_session_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_registrant record;
  v_program record;
  v_offering record;
  v_option record;
  v_participant record;
  v_person record;
  v_enrollment_id uuid;
  v_waitlist_id uuid;
  v_session_id uuid;
  v_is_adult boolean;
  v_participant_contact_id uuid;
  v_child_person_id uuid;
  v_child_name text;
  v_child_age integer;
  v_participant_type text;
  v_registrant_type text;
  v_today date;
  v_valid_session_count integer;
  v_next_position integer;
  v_enrollment_open boolean;
BEGIN
  v_user_id := auth.uid();
  v_today := CURRENT_DATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'register_for_program:unauthorized';
  END IF;

  IF NOT public.customer_has_org_access(p_organization_id) THEN
    RAISE EXCEPTION 'register_for_program:unauthorized';
  END IF;

  SELECT * INTO v_registrant
  FROM public.get_customer_contact(p_organization_id);

  IF v_registrant.id IS NULL THEN
    RAISE EXCEPTION 'register_for_program:unauthorized';
  END IF;

  SELECT *
  INTO v_program
  FROM public.programs p
  WHERE p.id = p_program_id
    AND p.organization_id = p_organization_id
    AND p.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_for_program:invalid-program';
  END IF;

  SELECT *
  INTO v_offering
  FROM public.program_offerings o
  WHERE o.organization_id = p_organization_id
    AND o.program_id = p_program_id
    AND o.is_default = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_for_program:invalid-offering';
  END IF;

  v_enrollment_open := true;
  IF COALESCE(v_offering.enrollment_open_date, v_program.enrollment_open_date) IS NOT NULL
     AND v_today < COALESCE(v_offering.enrollment_open_date, v_program.enrollment_open_date) THEN
    v_enrollment_open := false;
  END IF;
  IF COALESCE(v_offering.enrollment_close_date, v_program.enrollment_close_date) IS NOT NULL
     AND v_today > COALESCE(v_offering.enrollment_close_date, v_program.enrollment_close_date) THEN
    v_enrollment_open := false;
  END IF;

  IF NOT v_enrollment_open THEN
    RAISE EXCEPTION 'register_for_program:enrollment-closed';
  END IF;

  SELECT *
  INTO v_option
  FROM public.program_registration_options ro
  WHERE ro.id = p_registration_option_id
    AND ro.organization_id = p_organization_id
    AND ro.program_id = p_program_id
    AND ro.offering_id = v_offering.id
    AND ro.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_for_program:invalid-option';
  END IF;

  IF v_option.available_from IS NOT NULL AND v_today < v_option.available_from THEN
    RAISE EXCEPTION 'register_for_program:invalid-option';
  END IF;
  IF v_option.available_until IS NOT NULL AND v_today > v_option.available_until THEN
    RAISE EXCEPTION 'register_for_program:invalid-option';
  END IF;

  v_is_adult := COALESCE(v_program.program_type, 'youth') = 'adult';

  IF v_is_adult THEN
    v_participant_contact_id := v_registrant.id;
    v_participant_type := 'adult';
    v_registrant_type := 'adult_self';
  ELSE
    v_participant_type := CASE
      WHEN COALESCE(v_program.program_type, 'youth') = 'family' THEN 'family'
      ELSE 'youth'
    END;
    v_registrant_type := 'guardian';

    IF p_participant_contact_id IS NULL THEN
      RAISE EXCEPTION 'register_for_program:invalid-participant';
    END IF;

    v_participant_contact_id := p_participant_contact_id;

    IF v_registrant.person_id IS NULL THEN
      RAISE EXCEPTION 'register_for_program:invalid-participant';
    END IF;

    IF NOT public.is_registrant_family_participant(
      p_organization_id,
      v_registrant.person_id,
      v_participant_contact_id
    ) THEN
      RAISE EXCEPTION 'register_for_program:invalid-participant';
    END IF;
  END IF;

  SELECT c.id, c.person_id, c.full_name
  INTO v_participant
  FROM public.contacts c
  WHERE c.id = v_participant_contact_id
    AND c.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_for_program:invalid-participant';
  END IF;

  v_child_person_id := v_participant.person_id;
  v_child_name := COALESCE(NULLIF(btrim(v_participant.full_name), ''), NULLIF(btrim(p_parent_name), ''), 'Participant');

  IF v_child_person_id IS NOT NULL THEN
    SELECT p.id, p.date_of_birth
    INTO v_person
    FROM public.people p
    WHERE p.id = v_child_person_id
      AND p.organization_id = p_organization_id;

    IF FOUND AND v_person.date_of_birth IS NOT NULL THEN
      v_child_age := EXTRACT(YEAR FROM age(v_today, v_person.date_of_birth))::integer;
    END IF;
  END IF;

  IF p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0 THEN
    SELECT COUNT(*)
    INTO v_valid_session_count
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active'
      AND s.id = ANY(p_session_ids);

    IF v_valid_session_count IS DISTINCT FROM array_length(p_session_ids, 1) THEN
      RAISE EXCEPTION 'register_for_program:invalid-session';
    END IF;
  END IF;

  IF v_option.option_type = 'selected_sessions'
     AND (p_session_ids IS NULL OR array_length(p_session_ids, 1) IS NULL OR array_length(p_session_ids, 1) = 0) THEN
    RAISE EXCEPTION 'register_for_program:invalid-session';
  END IF;

  IF v_option.option_type IN ('single_session', 'drop_in')
     AND (p_session_ids IS NULL OR array_length(p_session_ids, 1) IS DISTINCT FROM 1) THEN
    RAISE EXCEPTION 'register_for_program:invalid-session';
  END IF;

  IF lower(COALESCE(p_mode, 'enroll')) = 'waitlist' THEN
    IF v_child_person_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.program_waitlist w
      WHERE w.organization_id = p_organization_id
        AND w.program_id = p_program_id
        AND w.child_person_id = v_child_person_id
    ) THEN
      RAISE EXCEPTION 'register_for_program:already-waitlisted';
    END IF;

    SELECT COALESCE(MAX(w.position), 0) + 1
    INTO v_next_position
    FROM public.program_waitlist w
    WHERE w.organization_id = p_organization_id
      AND w.program_id = p_program_id;

    INSERT INTO public.program_waitlist (
      organization_id,
      program_id,
      child_person_id,
      child_name,
      child_age,
      parent_name,
      parent_email,
      parent_phone,
      preferred_weeks,
      added_date,
      position,
      status,
      priority,
      notes
    )
    VALUES (
      p_organization_id,
      p_program_id,
      v_child_person_id,
      v_child_name,
      v_child_age,
      COALESCE(NULLIF(btrim(p_parent_name), ''), v_registrant.full_name),
      COALESCE(NULLIF(btrim(p_parent_email), ''), v_registrant.email),
      COALESCE(NULLIF(btrim(p_parent_phone), ''), v_registrant.phone),
      CASE
        WHEN p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0 THEN p_session_ids
        ELSE NULL
      END,
      v_today,
      v_next_position,
      'waiting',
      'normal',
      NULLIF(btrim(p_notes), '')
    )
    RETURNING id INTO v_waitlist_id;

    UPDATE public.programs
    SET waitlist = COALESCE(waitlist, 0) + 1,
        updated_at = NOW()
    WHERE id = p_program_id
      AND organization_id = p_organization_id;

    RETURN jsonb_build_object(
      'ok', true,
      'mode', 'waitlist',
      'waitlist_id', v_waitlist_id
    );
  END IF;

  IF v_program.capacity > 0 AND COALESCE(v_program.enrolled, 0) >= v_program.capacity THEN
    RAISE EXCEPTION 'register_for_program:capacity-full';
  END IF;

  IF v_participant_contact_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.program_id = p_program_id
      AND e.participant_contact_id = v_participant_contact_id
      AND lower(COALESCE(e.status, '')) <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  END IF;

  IF v_child_person_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.program_id = p_program_id
      AND e.child_person_id = v_child_person_id
      AND lower(COALESCE(e.status, '')) <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  END IF;

  INSERT INTO public.program_enrollments (
    organization_id,
    program_id,
    offering_id,
    department_id,
    registration_option_id,
    participant_contact_id,
    registrant_contact_id,
    payer_contact_id,
    participant_type,
    registrant_type,
    child_person_id,
    child_name,
    child_age,
    parent_name,
    parent_email,
    parent_phone,
    session_name,
    weeks,
    enrollment_date,
    status,
    payment_status,
    amount_paid,
    total_amount,
    before_care,
    after_care,
    lunch_type,
    notes
  )
  VALUES (
    p_organization_id,
    p_program_id,
    v_offering.id,
    v_program.department_id,
    p_registration_option_id,
    v_participant_contact_id,
    v_registrant.id,
    v_registrant.id,
    v_participant_type,
    v_registrant_type,
    v_child_person_id,
    v_child_name,
    v_child_age,
    COALESCE(NULLIF(btrim(p_parent_name), ''), v_registrant.full_name),
    COALESCE(NULLIF(btrim(p_parent_email), ''), v_registrant.email),
    COALESCE(NULLIF(btrim(p_parent_phone), ''), v_registrant.phone),
    NULLIF(btrim(p_session_name), ''),
    CASE
      WHEN p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0 THEN p_session_ids
      ELSE NULL
    END,
    v_today,
    'pending',
    'pending',
    0,
    COALESCE(p_total_amount, 0),
    COALESCE(p_before_care, false),
    COALESCE(p_after_care, false),
    NULLIF(btrim(p_lunch_type), ''),
    NULLIF(btrim(p_notes), '')
  )
  RETURNING id INTO v_enrollment_id;

  IF p_session_ids IS NOT NULL THEN
    FOREACH v_session_id IN ARRAY p_session_ids LOOP
      INSERT INTO public.program_registration_session_access (
        organization_id,
        enrollment_id,
        session_id,
        access_status
      )
      VALUES (
        p_organization_id,
        v_enrollment_id,
        v_session_id,
        'active'
      )
      ON CONFLICT (organization_id, enrollment_id, session_id) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.programs
  SET enrolled = COALESCE(enrolled, 0) + 1,
      updated_at = NOW()
  WHERE id = p_program_id
    AND organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'ok', true,
    'mode', 'enroll',
    'enrollment_id', v_enrollment_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'register_for_program:%' THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'register_for_program:save-failed';
END;
$$;

REVOKE ALL ON FUNCTION public.register_for_program(
  uuid, uuid, uuid, uuid, uuid[], text, text, text, text, text, boolean, boolean, text, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_for_program(
  uuid, uuid, uuid, uuid, uuid[], text, text, text, text, text, boolean, boolean, text, numeric, text
) TO authenticated;
