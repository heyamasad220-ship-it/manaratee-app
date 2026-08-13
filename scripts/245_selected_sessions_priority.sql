-- Selected-weeks priority: full Camp 1 / Camp 2 enroll now; partial weeks waitlist
-- until staff sets selected_sessions_open = true (then FIFO auto-promote from app).
-- Run after 244_session_capacity_per_offering.sql.

ALTER TABLE public.program_offerings
  ADD COLUMN IF NOT EXISTS selected_sessions_open BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.program_offerings.selected_sessions_open IS
  'When false, only full camp packages (all weeks in Camp 1 and/or Camp 2, or all offering sessions) may enroll immediately; selected/partial weeks go to waitlist. When true, selected weeks may enroll into open seats.';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Patched promote_waitlist (from 018)
-- - Drop early program-level capacity gate; per-session seats enforced by
--   grant_enrollment_session_access (244).
-- - Prefer waitlist.offering_id when set; else default offering.
-- App should set program_waitlist.offering_id on waitlist insert when possible.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_waitlist(
  p_organization_id uuid,
  p_waitlist_id uuid,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waitlist record;
  v_program record;
  v_offering record;
  v_old_status text;
  v_enrollment_id uuid;
  v_session_ids uuid[];
  v_participant_contact_id uuid;
  v_registrant_contact_id uuid;
  v_payer_contact_id uuid;
  v_child_person_id uuid;
  v_today date;
  v_program_name text;
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.is_org_staff(p_organization_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'lifecycle:unauthorized';
  END IF;

  v_today := CURRENT_DATE;

  SELECT w.*
  INTO v_waitlist
  FROM public.program_waitlist w
  WHERE w.id = p_waitlist_id
    AND w.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lifecycle:not-found';
  END IF;

  v_old_status := lower(COALESCE(v_waitlist.status, 'waiting'));

  IF v_old_status NOT IN ('waiting', 'offered') THEN
    RAISE EXCEPTION 'lifecycle:invalid-status';
  END IF;

  SELECT p.*
  INTO v_program
  FROM public.programs p
  WHERE p.id = v_waitlist.program_id
    AND p.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lifecycle:invalid-program';
  END IF;

  v_program_name := v_program.name;

  -- Per-session capacity enforced by grant_enrollment_session_access.

  IF v_waitlist.offering_id IS NOT NULL THEN
    SELECT o.*
    INTO v_offering
    FROM public.program_offerings o
    WHERE o.organization_id = p_organization_id
      AND o.id = v_waitlist.offering_id
    LIMIT 1;
  END IF;

  IF v_offering.id IS NULL THEN
    SELECT o.*
    INTO v_offering
    FROM public.program_offerings o
    WHERE o.organization_id = p_organization_id
      AND o.program_id = v_waitlist.program_id
      AND o.is_default = true
    LIMIT 1;
  END IF;

  v_session_ids := COALESCE(
    (
      SELECT array_agg(wid::uuid)
      FROM unnest(COALESCE(v_waitlist.preferred_weeks, ARRAY[]::text[])) AS wid
      WHERE wid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
    ARRAY[]::uuid[]
  );

  IF array_length(v_session_ids, 1) IS NULL OR array_length(v_session_ids, 1) = 0 THEN
    IF v_offering.id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.program_registration_options ro
      WHERE ro.organization_id = p_organization_id
        AND ro.offering_id = v_offering.id
        AND ro.option_type = 'full_program'
        AND ro.is_active = true
    ) THEN
      SELECT COALESCE(array_agg(s.id), '{}'::uuid[])
      INTO v_session_ids
      FROM public.program_sessions s
      WHERE s.organization_id = p_organization_id
        AND s.program_id = v_waitlist.program_id
        AND s.status = 'active';
    END IF;
  END IF;

  v_participant_contact_id := v_waitlist.participant_contact_id;
  v_child_person_id := v_waitlist.child_person_id;

  IF v_participant_contact_id IS NULL AND v_child_person_id IS NOT NULL THEN
    SELECT c.id INTO v_participant_contact_id
    FROM public.contacts c
    WHERE c.organization_id = p_organization_id
      AND c.person_id = v_child_person_id
    LIMIT 1;
  END IF;

  IF v_waitlist.parent_email IS NOT NULL THEN
    SELECT c.id INTO v_registrant_contact_id
    FROM public.contacts c
    WHERE c.organization_id = p_organization_id
      AND lower(c.email) = lower(btrim(v_waitlist.parent_email))
    LIMIT 1;
  END IF;

  v_payer_contact_id := v_registrant_contact_id;

  IF v_participant_contact_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.program_id = v_waitlist.program_id
      AND e.participant_contact_id = v_participant_contact_id
      AND public.enrollment_status_blocks_duplicate(e.status)
  ) THEN
    RAISE EXCEPTION 'lifecycle:already-enrolled';
  END IF;

  IF v_child_person_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.program_id = v_waitlist.program_id
      AND e.child_person_id = v_child_person_id
      AND public.enrollment_status_blocks_duplicate(e.status)
  ) THEN
    RAISE EXCEPTION 'lifecycle:already-enrolled';
  END IF;

  INSERT INTO public.program_enrollments (
    organization_id, program_id, offering_id, department_id,
    promoted_from_waitlist_id,
    participant_contact_id, registrant_contact_id, payer_contact_id,
    participant_type, registrant_type,
    child_person_id, child_name, child_age,
    parent_name, parent_email, parent_phone,
    session_name, weeks, enrollment_date,
    status, payment_status, amount_paid, total_amount,
    before_care, after_care, lunch_type, notes
  )
  VALUES (
    p_organization_id, v_waitlist.program_id, v_offering.id, v_program.department_id,
    p_waitlist_id,
    v_participant_contact_id, v_registrant_contact_id, v_payer_contact_id,
    'youth', 'guardian',
    v_child_person_id, v_waitlist.child_name, v_waitlist.child_age,
    v_waitlist.parent_name, v_waitlist.parent_email, v_waitlist.parent_phone,
    NULL,
    CASE WHEN array_length(v_session_ids, 1) > 0 THEN v_session_ids::text[] ELSE NULL END,
    v_today,
    'pending', 'pending', 0, 0,
    false, false, NULL, v_waitlist.notes
  )
  RETURNING id INTO v_enrollment_id;

  PERFORM public.grant_enrollment_session_access(p_organization_id, v_enrollment_id, v_session_ids);

  UPDATE public.program_waitlist
  SET
    status = 'accepted',
    promoted_enrollment_id = v_enrollment_id,
    participant_contact_id = COALESCE(participant_contact_id, v_participant_contact_id),
    updated_at = NOW()
  WHERE id = p_waitlist_id;

  UPDATE public.programs
  SET
    enrolled = COALESCE(enrolled, 0) + 1,
    waitlist = GREATEST(COALESCE(waitlist, 0) - 1, 0),
    updated_at = NOW()
  WHERE id = v_waitlist.program_id
    AND organization_id = p_organization_id;

  PERFORM public.write_enrollment_status_history(
    p_organization_id, v_enrollment_id, NULL, 'pending',
    'Promoted from waitlist', p_actor_user_id, 'staff',
    jsonb_build_object('waitlist_id', p_waitlist_id)
  );

  PERFORM public.write_waitlist_status_history(
    p_organization_id, p_waitlist_id, v_old_status, 'accepted',
    NULL, p_actor_user_id, 'staff',
    jsonb_build_object('enrollment_id', v_enrollment_id)
  );

  PERFORM public.write_lifecycle_event(
    p_organization_id, 'promote_waitlist', v_enrollment_id, p_waitlist_id,
    p_actor_user_id, 'staff',
    jsonb_build_object('from_waitlist_status', v_old_status)
  );

  PERFORM public.write_enrollment_contact_activities(
    p_organization_id, v_enrollment_id, v_program_name,
    'promoted_from_waitlist', 'pending'
  );

  RETURN jsonb_build_object(
    'ok', true, 'enrollment_id', v_enrollment_id,
    'waitlist_id', p_waitlist_id, 'status', 'pending'
  );
END;
$$;
