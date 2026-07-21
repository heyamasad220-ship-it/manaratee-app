-- 174: Allow multiple active enrollments in the same program across different offerings
-- (e.g. QIL year program with one offering per course).
--
-- Run in Supabase SQL Editor AFTER 173_department_budget_periods.sql
-- Required before consolidating QIL course-programs into one program with course offerings.

-- ---------------------------------------------------------------------------
-- 1) Unique active enrollment is per offering (not per program)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.program_enrollments_active_participant_uidx;
DROP INDEX IF EXISTS public.program_enrollments_active_child_person_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS program_enrollments_active_participant_offering_uidx
  ON public.program_enrollments (organization_id, offering_id, participant_contact_id)
  WHERE participant_contact_id IS NOT NULL
    AND offering_id IS NOT NULL
    AND public.enrollment_status_blocks_duplicate(status);

CREATE UNIQUE INDEX IF NOT EXISTS program_enrollments_active_child_person_offering_uidx
  ON public.program_enrollments (organization_id, offering_id, child_person_id)
  WHERE child_person_id IS NOT NULL
    AND offering_id IS NOT NULL
    AND public.enrollment_status_blocks_duplicate(status);

COMMENT ON INDEX public.program_enrollments_active_participant_offering_uidx IS
  'One active enrollment per participant per offering (multi-course programs allowed).';

-- ---------------------------------------------------------------------------
-- 2) register_for_program: duplicate check by offering (default offering today)
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
  p_lunch_option_id uuid,
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
  v_is_adult boolean;
  v_participant_contact_id uuid;
  v_child_person_id uuid;
  v_child_name text;
  v_child_age integer;
  v_participant_type text;
  v_registrant_type text;
  v_today date;
  v_next_position integer;
  v_enrollment_open boolean;
  v_program_name text;
  v_addons jsonb;
  v_quote jsonb;
  v_total_amount numeric;
  v_resolved_session_ids uuid[];
  v_due_today numeric;
  v_payment_required boolean;
  v_initial_status text;
  v_capacity_hold_type text;
  v_charge_id uuid;
  v_payment_status text;
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

  v_program_name := v_program.name;

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

  BEGIN
    v_resolved_session_ids := public.resolve_registration_session_ids(
      p_organization_id,
      p_program_id,
      v_offering.id,
      v_option.option_type,
      p_session_ids
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'quote:invalid-session%' THEN
        RAISE EXCEPTION 'register_for_program:invalid-session';
      END IF;
      RAISE;
  END;

  IF lower(COALESCE(p_mode, 'enroll')) = 'waitlist' THEN
    IF v_child_person_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.program_waitlist w
      WHERE w.organization_id = p_organization_id
        AND w.program_id = p_program_id
        AND w.child_person_id = v_child_person_id
        AND lower(COALESCE(w.status, 'waiting')) IN ('waiting', 'offered')
    ) THEN
      RAISE EXCEPTION 'register_for_program:already-waitlisted';
    END IF;

    SELECT COALESCE(MAX(w.position), 0) + 1
    INTO v_next_position
    FROM public.program_waitlist w
    WHERE w.organization_id = p_organization_id
      AND w.program_id = p_program_id;

    INSERT INTO public.program_waitlist (
      organization_id, program_id, child_person_id, participant_contact_id,
      child_name, child_age, parent_name, parent_email, parent_phone,
      preferred_weeks, added_date, position, status, priority, notes
    )
    VALUES (
      p_organization_id, p_program_id, v_child_person_id, v_participant_contact_id,
      v_child_name, v_child_age,
      COALESCE(NULLIF(btrim(p_parent_name), ''), v_registrant.full_name),
      COALESCE(NULLIF(btrim(p_parent_email), ''), v_registrant.email),
      COALESCE(NULLIF(btrim(p_parent_phone), ''), v_registrant.phone),
      CASE WHEN COALESCE(array_length(v_resolved_session_ids, 1), 0) > 0
        THEN v_resolved_session_ids::text[] ELSE NULL END,
      v_today, v_next_position, 'waiting', 'normal', NULLIF(btrim(p_notes), '')
    )
    RETURNING id INTO v_waitlist_id;

    UPDATE public.programs
    SET waitlist = COALESCE(waitlist, 0) + 1, updated_at = NOW()
    WHERE id = p_program_id AND organization_id = p_organization_id;

    PERFORM public.write_waitlist_status_history(
      p_organization_id, v_waitlist_id, NULL, 'waiting', NULL, v_user_id, 'customer', '{}'
    );
    PERFORM public.write_lifecycle_event(
      p_organization_id, 'join_waitlist', NULL, v_waitlist_id, v_user_id, 'customer',
      jsonb_build_object('program_id', p_program_id)
    );

    RETURN jsonb_build_object('ok', true, 'mode', 'waitlist', 'waitlist_id', v_waitlist_id);
  END IF;

  IF v_program.capacity > 0 AND COALESCE(v_program.enrolled, 0) >= v_program.capacity THEN
    RAISE EXCEPTION 'register_for_program:capacity-full';
  END IF;

  -- Duplicate = already enrolled in THIS offering (not the whole program).
  IF v_participant_contact_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.offering_id = v_offering.id
      AND e.participant_contact_id = v_participant_contact_id
      AND public.enrollment_status_blocks_duplicate(e.status)
  ) THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  END IF;

  IF v_child_person_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.offering_id = v_offering.id
      AND e.child_person_id = v_child_person_id
      AND public.enrollment_status_blocks_duplicate(e.status)
  ) THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  END IF;

  v_addons := jsonb_build_object(
    'before_care', COALESCE(p_before_care, false),
    'after_care', COALESCE(p_after_care, false),
    'lunch_option_id', p_lunch_option_id
  );

  v_quote := public.compute_program_registration_quote(
    p_organization_id, p_program_id, v_offering.id, p_registration_option_id,
    v_registrant.id, v_participant_contact_id, p_session_ids, v_addons
  );

  v_total_amount := COALESCE((v_quote->>'total')::numeric, 0);
  v_due_today := public.quote_due_today_from_snapshot(v_quote);
  v_payment_required := public.resolve_registration_payment_required(
    p_organization_id, v_due_today
  );
  v_initial_status := public.resolve_initial_enrollment_status(
    p_organization_id, v_due_today
  );
  v_capacity_hold_type := public.resolve_enrollment_capacity_hold_type(
    p_organization_id, v_payment_required, v_initial_status
  );
  v_payment_status := CASE
    WHEN v_due_today <= 0 THEN 'paid'
    ELSE 'pending'
  END;

  SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
  INTO v_resolved_session_ids
  FROM jsonb_array_elements_text(COALESCE(v_quote->'resolved_session_ids', '[]'::jsonb)) AS value;

  INSERT INTO public.program_enrollments (
    organization_id, program_id, offering_id, department_id, registration_option_id,
    participant_contact_id, registrant_contact_id, payer_contact_id,
    participant_type, registrant_type, child_person_id, child_name, child_age,
    parent_name, parent_email, parent_phone, session_name, weeks,
    enrollment_date, status, payment_status, amount_paid, total_amount,
    before_care, after_care, lunch_type, notes, quote_snapshot,
    payment_required, capacity_hold_type
  )
  VALUES (
    p_organization_id, p_program_id, v_offering.id, v_program.department_id, p_registration_option_id,
    v_participant_contact_id, v_registrant.id, v_registrant.id,
    v_participant_type, v_registrant_type, v_child_person_id, v_child_name, v_child_age,
    COALESCE(NULLIF(btrim(p_parent_name), ''), v_registrant.full_name),
    COALESCE(NULLIF(btrim(p_parent_email), ''), v_registrant.email),
    COALESCE(NULLIF(btrim(p_parent_phone), ''), v_registrant.phone),
    NULLIF(btrim(p_session_name), ''),
    CASE WHEN COALESCE(array_length(v_resolved_session_ids, 1), 0) > 0
      THEN v_resolved_session_ids::text[] ELSE NULL END,
    v_today, v_initial_status, v_payment_status, 0, v_total_amount,
    COALESCE(p_before_care, false), COALESCE(p_after_care, false),
    NULLIF(btrim(p_lunch_type), ''), NULLIF(btrim(p_notes), ''),
    v_quote,
    v_payment_required, v_capacity_hold_type
  )
  RETURNING id INTO v_enrollment_id;

  PERFORM public.grant_enrollment_session_access(
    p_organization_id, v_enrollment_id, v_resolved_session_ids
  );

  v_charge_id := public.build_program_charge_from_quote(
    p_organization_id,
    v_quote,
    v_enrollment_id,
    p_program_id,
    v_offering.id,
    p_registration_option_id,
    v_registrant.id,
    v_registrant.id,
    v_participant_contact_id,
    NULL,
    v_today
  );

  UPDATE public.programs
  SET enrolled = COALESCE(enrolled, 0) + 1, updated_at = NOW()
  WHERE id = p_program_id AND organization_id = p_organization_id;

  PERFORM public.write_enrollment_status_history(
    p_organization_id, v_enrollment_id, NULL, v_initial_status, NULL, v_user_id, 'customer', '{}'
  );
  PERFORM public.write_lifecycle_event(
    p_organization_id, 'register', v_enrollment_id, NULL, v_user_id, 'customer',
    jsonb_build_object(
      'program_id', p_program_id,
      'registration_option_id', p_registration_option_id,
      'quote', v_quote
    )
  );
  PERFORM public.write_enrollment_contact_activities(
    p_organization_id, v_enrollment_id, v_program_name, 'registered_program', v_initial_status
  );

  RETURN jsonb_build_object(
    'ok', true, 'mode', 'enroll', 'enrollment_id', v_enrollment_id,
    'charge_id', v_charge_id,
    'status', v_initial_status,
    'payment_required', v_payment_required,
    'due_today', v_due_today,
    'total_amount', v_total_amount,
    'quote', v_quote
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'register_for_program:%' OR SQLERRM LIKE 'quote:%' OR SQLERRM LIKE 'charge:%' THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'register_for_program:save-failed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_program(
  uuid, uuid, uuid, uuid, uuid[], text, text, text, text, text, boolean, boolean, text, uuid, numeric, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Verification
-- ---------------------------------------------------------------------------
SELECT
  to_regclass('public.program_enrollments_active_participant_offering_uidx') IS NOT NULL
    AS participant_offering_uidx_exists,
  to_regclass('public.program_enrollments_active_child_person_offering_uidx') IS NOT NULL
    AS child_offering_uidx_exists,
  to_regclass('public.program_enrollments_active_participant_uidx') IS NULL
    AS old_participant_uidx_removed;
