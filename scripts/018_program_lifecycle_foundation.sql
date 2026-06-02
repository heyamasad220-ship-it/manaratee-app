-- Phase: Lifecycle foundation — history tables, restricted transitions, orchestrated RPCs
-- Run in Supabase SQL Editor after 017_customer_program_registration_rpc.sql
--
-- Waitlist promotion creates enrollment status = pending (staff confirms via advance_enrollment_status).
-- Includes lifecycle RPCs, register_for_program history update, and grants.

-- ---------------------------------------------------------------------------
-- 1) History tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_enrollment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.program_enrollments(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_user_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (
    actor_type IN ('customer', 'staff', 'admin', 'system')
  ),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_enrollment_status_history_enrollment_idx
  ON public.program_enrollment_status_history(organization_id, enrollment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.program_waitlist_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  waitlist_id UUID NOT NULL REFERENCES public.program_waitlist(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_user_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (
    actor_type IN ('customer', 'staff', 'admin', 'system')
  ),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_waitlist_status_history_waitlist_idx
  ON public.program_waitlist_status_history(organization_id, waitlist_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.program_registration_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  enrollment_id UUID REFERENCES public.program_enrollments(id) ON DELETE SET NULL,
  waitlist_id UUID REFERENCES public.program_waitlist(id) ON DELETE SET NULL,
  actor_user_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (
    actor_type IN ('customer', 'staff', 'admin', 'system')
  ),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_registration_lifecycle_events_org_idx
  ON public.program_registration_lifecycle_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS program_registration_lifecycle_events_enrollment_idx
  ON public.program_registration_lifecycle_events(organization_id, enrollment_id);

ALTER TABLE public.program_enrollment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_waitlist_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_registration_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view enrollment status history" ON public.program_enrollment_status_history;
CREATE POLICY "Org members view enrollment status history"
  ON public.program_enrollment_status_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage enrollment status history" ON public.program_enrollment_status_history;
CREATE POLICY "Org members manage enrollment status history"
  ON public.program_enrollment_status_history FOR ALL
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

DROP POLICY IF EXISTS "Org members view waitlist status history" ON public.program_waitlist_status_history;
CREATE POLICY "Org members view waitlist status history"
  ON public.program_waitlist_status_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage waitlist status history" ON public.program_waitlist_status_history;
CREATE POLICY "Org members manage waitlist status history"
  ON public.program_waitlist_status_history FOR ALL
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

DROP POLICY IF EXISTS "Org members view registration lifecycle events" ON public.program_registration_lifecycle_events;
CREATE POLICY "Org members view registration lifecycle events"
  ON public.program_registration_lifecycle_events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage registration lifecycle events" ON public.program_registration_lifecycle_events;
CREATE POLICY "Org members manage registration lifecycle events"
  ON public.program_registration_lifecycle_events FOR ALL
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

-- ---------------------------------------------------------------------------
-- 2) Extend program_enrollments
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_enrollments
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdraw_reason TEXT,
  ADD COLUMN IF NOT EXISTS transferred_from_enrollment_id UUID
    REFERENCES public.program_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferred_to_enrollment_id UUID
    REFERENCES public.program_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_from_waitlist_id UUID
    REFERENCES public.program_waitlist(id) ON DELETE SET NULL;

ALTER TABLE public.program_enrollments
  DROP CONSTRAINT IF EXISTS program_enrollments_status_check;

ALTER TABLE public.program_enrollments
  ADD CONSTRAINT program_enrollments_status_check
  CHECK (
    status IS NULL OR status IN (
      'pending', 'enrolled', 'active', 'completed',
      'cancelled', 'withdrawn', 'transferred'
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Extend program_waitlist
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_waitlist
  ADD COLUMN IF NOT EXISTS participant_contact_id UUID
    REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_enrollment_id UUID
    REFERENCES public.program_enrollments(id) ON DELETE SET NULL;

UPDATE public.program_waitlist AS w
SET participant_contact_id = c.id
FROM public.contacts AS c
WHERE w.participant_contact_id IS NULL
  AND w.child_person_id IS NOT NULL
  AND c.organization_id = w.organization_id
  AND c.person_id = w.child_person_id;

UPDATE public.program_waitlist
SET status = 'waiting'
WHERE status IS NULL OR btrim(status) = '';

ALTER TABLE public.program_waitlist
  DROP CONSTRAINT IF EXISTS program_waitlist_status_check;

ALTER TABLE public.program_waitlist
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.program_waitlist
  ADD CONSTRAINT program_waitlist_status_check
  CHECK (
    status IS NULL OR status IN (
      'waiting', 'offered', 'accepted', 'declined', 'expired', 'removed'
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Lifecycle helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_staff(
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(
  p_organization_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_user_id
      AND om.role IN ('super_admin', 'admin', 'owner', 'coordinator')
  );
$$;

CREATE OR REPLACE FUNCTION public.enrollment_status_counts_toward_capacity(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(COALESCE(p_status, '')) IN ('pending', 'enrolled', 'active');
$$;

CREATE OR REPLACE FUNCTION public.enrollment_status_blocks_duplicate(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(COALESCE(p_status, '')) IN ('pending', 'enrolled', 'active');
$$;

CREATE OR REPLACE FUNCTION public.is_allowed_enrollment_transition(
  p_from_status text,
  p_to_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(COALESCE(p_from_status, ''))
    WHEN 'pending' THEN lower(p_to_status) IN ('enrolled', 'cancelled')
    WHEN 'enrolled' THEN lower(p_to_status) IN ('active', 'cancelled')
    WHEN 'active' THEN lower(p_to_status) IN ('completed', 'cancelled')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.write_enrollment_status_history(
  p_organization_id uuid,
  p_enrollment_id uuid,
  p_from_status text,
  p_to_status text,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_type text,
  p_payload jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.program_enrollment_status_history (
    organization_id, enrollment_id, from_status, to_status,
    reason, actor_user_id, actor_type, payload
  )
  VALUES (
    p_organization_id, p_enrollment_id, p_from_status, p_to_status,
    p_reason, p_actor_user_id, p_actor_type, COALESCE(p_payload, '{}')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.write_waitlist_status_history(
  p_organization_id uuid,
  p_waitlist_id uuid,
  p_from_status text,
  p_to_status text,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_type text,
  p_payload jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.program_waitlist_status_history (
    organization_id, waitlist_id, from_status, to_status,
    reason, actor_user_id, actor_type, payload
  )
  VALUES (
    p_organization_id, p_waitlist_id, p_from_status, p_to_status,
    p_reason, p_actor_user_id, p_actor_type, COALESCE(p_payload, '{}')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.write_lifecycle_event(
  p_organization_id uuid,
  p_action text,
  p_enrollment_id uuid,
  p_waitlist_id uuid,
  p_actor_user_id uuid,
  p_actor_type text,
  p_payload jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.program_registration_lifecycle_events (
    organization_id, action, enrollment_id, waitlist_id,
    actor_user_id, actor_type, payload
  )
  VALUES (
    p_organization_id, p_action, p_enrollment_id, p_waitlist_id,
    p_actor_user_id, p_actor_type, COALESCE(p_payload, '{}')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.write_program_contact_activity(
  p_organization_id uuid,
  p_contact_id uuid,
  p_activity_type text,
  p_title text,
  p_subtitle text,
  p_reference_table text,
  p_reference_id uuid,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.contact_activities (
    organization_id,
    contact_id,
    module,
    activity_type,
    reference_table,
    reference_id,
    title,
    subtitle,
    activity_date,
    status
  )
  VALUES (
    p_organization_id,
    p_contact_id,
    'programs',
    p_activity_type,
    p_reference_table,
    p_reference_id,
    p_title,
    p_subtitle,
    NOW(),
    p_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.write_enrollment_contact_activities(
  p_organization_id uuid,
  p_enrollment_id uuid,
  p_program_name text,
  p_activity_type text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_title text;
BEGIN
  SELECT
    participant_contact_id,
    registrant_contact_id,
    payer_contact_id
  INTO v_row
  FROM public.program_enrollments
  WHERE id = p_enrollment_id
    AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_title := COALESCE(p_program_name, 'Program');

  PERFORM public.write_program_contact_activity(
    p_organization_id, v_row.participant_contact_id, p_activity_type,
    'Registered for ' || v_title, NULL, 'program_enrollments', p_enrollment_id, p_status
  );

  IF v_row.registrant_contact_id IS DISTINCT FROM v_row.participant_contact_id THEN
    PERFORM public.write_program_contact_activity(
      p_organization_id, v_row.registrant_contact_id, p_activity_type,
      'Registration for ' || v_title, NULL, 'program_enrollments', p_enrollment_id, p_status
    );
  END IF;

  IF v_row.payer_contact_id IS DISTINCT FROM v_row.participant_contact_id
     AND v_row.payer_contact_id IS DISTINCT FROM v_row.registrant_contact_id THEN
    PERFORM public.write_program_contact_activity(
      p_organization_id, v_row.payer_contact_id, p_activity_type,
      'Registration for ' || v_title, NULL, 'program_enrollments', p_enrollment_id, p_status
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_program_capacity_delta(
  p_organization_id uuid,
  p_program_id uuid,
  p_old_status text,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_counting boolean;
  v_should_count boolean;
BEGIN
  v_was_counting := public.enrollment_status_counts_toward_capacity(p_old_status);
  v_should_count := public.enrollment_status_counts_toward_capacity(p_new_status);

  IF v_was_counting = v_should_count THEN
    RETURN;
  END IF;

  IF v_should_count THEN
    UPDATE public.programs
    SET enrolled = COALESCE(enrolled, 0) + 1, updated_at = NOW()
    WHERE id = p_program_id AND organization_id = p_organization_id;
  ELSE
    UPDATE public.programs
    SET enrolled = GREATEST(COALESCE(enrolled, 0) - 1, 0), updated_at = NOW()
    WHERE id = p_program_id AND organization_id = p_organization_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_enrollment_session_capacity(
  p_organization_id uuid,
  p_enrollment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access record;
BEGIN
  FOR v_access IN
    SELECT session_id
    FROM public.program_registration_session_access
    WHERE organization_id = p_organization_id
      AND enrollment_id = p_enrollment_id
      AND access_status = 'active'
  LOOP
    UPDATE public.program_sessions
    SET enrolled = GREATEST(COALESCE(enrolled, 0) - 1, 0), updated_at = NOW()
    WHERE id = v_access.session_id
      AND organization_id = p_organization_id;

    UPDATE public.program_registration_session_access
    SET access_status = 'cancelled', updated_at = NOW()
    WHERE organization_id = p_organization_id
      AND enrollment_id = p_enrollment_id
      AND session_id = v_access.session_id
      AND access_status = 'active';
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_enrollment_session_access(
  p_organization_id uuid,
  p_enrollment_id uuid,
  p_session_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_inserted integer;
BEGIN
  IF p_session_ids IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_session_id IN ARRAY p_session_ids LOOP
    INSERT INTO public.program_registration_session_access (
      organization_id, enrollment_id, session_id, access_status
    )
    VALUES (p_organization_id, p_enrollment_id, v_session_id, 'active')
    ON CONFLICT (organization_id, enrollment_id, session_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN
      UPDATE public.program_sessions
      SET enrolled = COALESCE(enrolled, 0) + 1, updated_at = NOW()
      WHERE id = v_session_id AND organization_id = p_organization_id;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) cancel_enrollment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_enrollment(
  p_organization_id uuid,
  p_enrollment_id uuid,
  p_cancel_reason text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment record;
  v_program_name text;
  v_old_status text;
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.is_org_staff(p_organization_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'lifecycle:unauthorized';
  END IF;

  SELECT e.*, p.name AS program_name
  INTO v_enrollment
  FROM public.program_enrollments e
  JOIN public.programs p ON p.id = e.program_id AND p.organization_id = e.organization_id
  WHERE e.id = p_enrollment_id
    AND e.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lifecycle:not-found';
  END IF;

  v_old_status := lower(COALESCE(v_enrollment.status, ''));

  IF v_old_status = 'cancelled' THEN
    RAISE EXCEPTION 'lifecycle:already-cancelled';
  END IF;

  IF NOT public.is_allowed_enrollment_transition(v_old_status, 'cancelled') THEN
    RAISE EXCEPTION 'lifecycle:invalid-transition';
  END IF;

  PERFORM public.release_enrollment_session_capacity(p_organization_id, p_enrollment_id);

  UPDATE public.program_enrollments
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancel_reason = NULLIF(btrim(p_cancel_reason), ''),
    updated_at = NOW()
  WHERE id = p_enrollment_id
    AND organization_id = p_organization_id;

  PERFORM public.apply_program_capacity_delta(
    p_organization_id, v_enrollment.program_id, v_old_status, 'cancelled'
  );

  PERFORM public.write_enrollment_status_history(
    p_organization_id, p_enrollment_id, v_old_status, 'cancelled',
    p_cancel_reason, p_actor_user_id, 'staff', '{}'
  );

  PERFORM public.write_lifecycle_event(
    p_organization_id, 'cancel_enrollment', p_enrollment_id, NULL,
    p_actor_user_id, 'staff',
    jsonb_build_object('from_status', v_old_status, 'reason', p_cancel_reason)
  );

  PERFORM public.write_enrollment_contact_activities(
    p_organization_id, p_enrollment_id, v_enrollment.program_name,
    'registration_cancelled', 'cancelled'
  );

  RETURN jsonb_build_object('ok', true, 'enrollment_id', p_enrollment_id, 'status', 'cancelled');
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) advance_enrollment_status (restricted forward transitions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_enrollment_status(
  p_organization_id uuid,
  p_enrollment_id uuid,
  p_target_status text,
  p_reason text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment record;
  v_program_name text;
  v_old_status text;
  v_new_status text;
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.is_org_staff(p_organization_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'lifecycle:unauthorized';
  END IF;

  v_new_status := lower(btrim(COALESCE(p_target_status, '')));

  SELECT e.*, p.name AS program_name
  INTO v_enrollment
  FROM public.program_enrollments e
  JOIN public.programs p ON p.id = e.program_id AND p.organization_id = e.organization_id
  WHERE e.id = p_enrollment_id
    AND e.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lifecycle:not-found';
  END IF;

  v_old_status := lower(COALESCE(v_enrollment.status, ''));

  IF NOT public.is_allowed_enrollment_transition(v_old_status, v_new_status) THEN
    RAISE EXCEPTION 'lifecycle:invalid-transition';
  END IF;

  UPDATE public.program_enrollments
  SET status = v_new_status, updated_at = NOW()
  WHERE id = p_enrollment_id
    AND organization_id = p_organization_id;

  PERFORM public.apply_program_capacity_delta(
    p_organization_id, v_enrollment.program_id, v_old_status, v_new_status
  );

  PERFORM public.write_enrollment_status_history(
    p_organization_id, p_enrollment_id, v_old_status, v_new_status,
    p_reason, p_actor_user_id, 'staff', '{}'
  );

  PERFORM public.write_lifecycle_event(
    p_organization_id, 'advance_enrollment_status', p_enrollment_id, NULL,
    p_actor_user_id, 'staff',
    jsonb_build_object('from_status', v_old_status, 'to_status', v_new_status)
  );

  PERFORM public.write_enrollment_contact_activities(
    p_organization_id, p_enrollment_id, v_enrollment.program_name,
    'registration_status_changed', v_new_status
  );

  RETURN jsonb_build_object(
    'ok', true, 'enrollment_id', p_enrollment_id,
    'from_status', v_old_status, 'to_status', v_new_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) admin_override_enrollment_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_override_enrollment_status(
  p_organization_id uuid,
  p_enrollment_id uuid,
  p_target_status text,
  p_reason text,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment record;
  v_old_status text;
  v_new_status text;
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.is_org_admin(p_organization_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'lifecycle:unauthorized';
  END IF;

  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'lifecycle:reason-required';
  END IF;

  v_new_status := lower(btrim(p_target_status));

  IF v_new_status NOT IN (
    'pending', 'enrolled', 'active', 'completed', 'cancelled', 'withdrawn', 'transferred'
  ) THEN
    RAISE EXCEPTION 'lifecycle:invalid-status';
  END IF;

  SELECT e.*
  INTO v_enrollment
  FROM public.program_enrollments e
  WHERE e.id = p_enrollment_id
    AND e.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lifecycle:not-found';
  END IF;

  v_old_status := lower(COALESCE(v_enrollment.status, ''));

  IF v_old_status = v_new_status THEN
    RAISE EXCEPTION 'lifecycle:no-op';
  END IF;

  UPDATE public.program_enrollments
  SET
    status = v_new_status,
    cancelled_at = CASE WHEN v_new_status = 'cancelled' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
    cancel_reason = CASE WHEN v_new_status = 'cancelled' THEN COALESCE(cancel_reason, p_reason) ELSE cancel_reason END,
    updated_at = NOW()
  WHERE id = p_enrollment_id;

  PERFORM public.apply_program_capacity_delta(
    p_organization_id, v_enrollment.program_id, v_old_status, v_new_status
  );

  PERFORM public.write_enrollment_status_history(
    p_organization_id, p_enrollment_id, v_old_status, v_new_status,
    p_reason, p_actor_user_id, 'admin',
    jsonb_build_object('override', true)
  );

  PERFORM public.write_lifecycle_event(
    p_organization_id, 'admin_override_enrollment_status', p_enrollment_id, NULL,
    p_actor_user_id, 'admin',
    jsonb_build_object('from_status', v_old_status, 'to_status', v_new_status, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'ok', true, 'enrollment_id', p_enrollment_id,
    'from_status', v_old_status, 'to_status', v_new_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) remove_waitlist
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_waitlist(
  p_organization_id uuid,
  p_waitlist_id uuid,
  p_reason text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waitlist record;
  v_old_status text;
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.is_org_staff(p_organization_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'lifecycle:unauthorized';
  END IF;

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

  IF v_old_status IN ('accepted', 'removed') THEN
    RAISE EXCEPTION 'lifecycle:invalid-status';
  END IF;

  UPDATE public.program_waitlist
  SET status = 'removed', updated_at = NOW()
  WHERE id = p_waitlist_id;

  UPDATE public.programs
  SET waitlist = GREATEST(COALESCE(waitlist, 0) - 1, 0), updated_at = NOW()
  WHERE id = v_waitlist.program_id
    AND organization_id = p_organization_id;

  PERFORM public.write_waitlist_status_history(
    p_organization_id, p_waitlist_id, v_old_status, 'removed',
    p_reason, p_actor_user_id, 'staff', '{}'
  );

  PERFORM public.write_lifecycle_event(
    p_organization_id, 'remove_waitlist', NULL, p_waitlist_id,
    p_actor_user_id, 'staff', jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('ok', true, 'waitlist_id', p_waitlist_id, 'status', 'removed');
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) promote_waitlist (creates enrollment status = pending)
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

  IF v_program.capacity > 0 AND COALESCE(v_program.enrolled, 0) >= v_program.capacity THEN
    RAISE EXCEPTION 'lifecycle:capacity-full';
  END IF;

  SELECT o.*
  INTO v_offering
  FROM public.program_offerings o
  WHERE o.organization_id = p_organization_id
    AND o.program_id = v_waitlist.program_id
    AND o.is_default = true
  LIMIT 1;

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

-- ---------------------------------------------------------------------------
-- 10) Update register_for_program — lifecycle history on register / waitlist
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
  v_program_name text;
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
      organization_id,
      program_id,
      child_person_id,
      participant_contact_id,
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
      v_participant_contact_id,
      v_child_name,
      v_child_age,
      COALESCE(NULLIF(btrim(p_parent_name), ''), v_registrant.full_name),
      COALESCE(NULLIF(btrim(p_parent_email), ''), v_registrant.email),
      COALESCE(NULLIF(btrim(p_parent_phone), ''), v_registrant.phone),
      CASE
        WHEN p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0 THEN p_session_ids::text[]
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

    PERFORM public.write_waitlist_status_history(
      p_organization_id, v_waitlist_id, NULL, 'waiting',
      NULL, v_user_id, 'customer', '{}'
    );

    PERFORM public.write_lifecycle_event(
      p_organization_id, 'join_waitlist', NULL, v_waitlist_id,
      v_user_id, 'customer',
      jsonb_build_object('program_id', p_program_id)
    );

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
      AND public.enrollment_status_blocks_duplicate(e.status)
  ) THEN
    RAISE EXCEPTION 'register_for_program:already-enrolled';
  END IF;

  IF v_child_person_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.program_enrollments e
    WHERE e.organization_id = p_organization_id
      AND e.program_id = p_program_id
      AND e.child_person_id = v_child_person_id
      AND public.enrollment_status_blocks_duplicate(e.status)
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
      WHEN p_session_ids IS NOT NULL AND array_length(p_session_ids, 1) > 0 THEN p_session_ids::text[]
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

  PERFORM public.grant_enrollment_session_access(
    p_organization_id, v_enrollment_id, p_session_ids
  );

  UPDATE public.programs
  SET enrolled = COALESCE(enrolled, 0) + 1,
      updated_at = NOW()
  WHERE id = p_program_id
    AND organization_id = p_organization_id;

  PERFORM public.write_enrollment_status_history(
    p_organization_id, v_enrollment_id, NULL, 'pending',
    NULL, v_user_id, 'customer', '{}'
  );

  PERFORM public.write_lifecycle_event(
    p_organization_id, 'register', v_enrollment_id, NULL,
    v_user_id, 'customer',
    jsonb_build_object('program_id', p_program_id, 'registration_option_id', p_registration_option_id)
  );

  PERFORM public.write_enrollment_contact_activities(
    p_organization_id, v_enrollment_id, v_program_name,
    'registered_program', 'pending'
  );

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

-- ---------------------------------------------------------------------------
-- 11) Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.cancel_enrollment(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_enrollment_status(uuid, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_override_enrollment_status(uuid, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_waitlist(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_waitlist(uuid, uuid, uuid) TO authenticated;
