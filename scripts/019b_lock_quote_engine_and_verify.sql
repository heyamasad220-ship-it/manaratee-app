-- Emergency patch 019B — lock quote engine + verify 019A objects
-- Run after 019_program_fee_plans_quote_engine.sql
-- Safe to re-run (idempotent). Does NOT implement Phase 2B billing/charges.
--
-- Fixes partial 019A application:
--   • quote_snapshot column
--   • resolve_registration_session_ids()
--   • compute_program_registration_quote locked to internal use only

-- ---------------------------------------------------------------------------
-- 0) Preconditions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure(
    'public.compute_program_registration_quote(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION '019b: compute_program_registration_quote not found — run 019 first';
  END IF;

  IF to_regprocedure(
    'public.quote_program_registration(uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION '019b: quote_program_registration not found — run 019 first';
  END IF;

  IF to_regprocedure(
    'public.register_for_program(uuid,uuid,uuid,uuid,uuid[],text,text,text,text,text,boolean,boolean,text,uuid,numeric,text)'
  ) IS NULL THEN
    RAISE EXCEPTION '019b: register_for_program not found — run 017/018/019 first';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) quote_snapshot on enrollments
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_enrollments
  ADD COLUMN IF NOT EXISTS quote_snapshot JSONB;

-- ---------------------------------------------------------------------------
-- 2) Unified session resolution (internal helper)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_registration_session_ids(
  p_organization_id uuid,
  p_program_id uuid,
  p_offering_id uuid,
  p_option_type text,
  p_selected_session_ids uuid[]
)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering_sessions uuid[];
  v_fallback_sessions uuid[];
  v_valid_count integer;
BEGIN
  IF p_option_type = 'full_program' THEN
    SELECT COALESCE(
      array_agg(s.id ORDER BY s.sort_order NULLS LAST, s.start_date, s.id),
      '{}'::uuid[]
    )
    INTO v_offering_sessions
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active'
      AND s.offering_id = p_offering_id;

    IF COALESCE(array_length(v_offering_sessions, 1), 0) > 0 THEN
      RETURN v_offering_sessions;
    END IF;

    SELECT COALESCE(
      array_agg(s.id ORDER BY s.sort_order NULLS LAST, s.start_date, s.id),
      '{}'::uuid[]
    )
    INTO v_fallback_sessions
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active';

    RETURN COALESCE(v_fallback_sessions, '{}'::uuid[]);
  END IF;

  IF p_option_type = 'selected_sessions' THEN
    IF p_selected_session_ids IS NULL
       OR array_length(p_selected_session_ids, 1) IS NULL
       OR array_length(p_selected_session_ids, 1) = 0 THEN
      RAISE EXCEPTION 'quote:invalid-session';
    END IF;

    SELECT COUNT(*)
    INTO v_valid_count
    FROM public.program_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.program_id = p_program_id
      AND s.status = 'active'
      AND s.id = ANY(p_selected_session_ids);

    IF v_valid_count IS DISTINCT FROM array_length(p_selected_session_ids, 1) THEN
      RAISE EXCEPTION 'quote:invalid-session';
    END IF;

    RETURN p_selected_session_ids;
  END IF;

  IF p_option_type IN ('single_session', 'drop_in') THEN
    IF p_selected_session_ids IS NULL
       OR array_length(p_selected_session_ids, 1) IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'quote:invalid-session';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.program_sessions s
      WHERE s.organization_id = p_organization_id
        AND s.program_id = p_program_id
        AND s.status = 'active'
        AND s.id = p_selected_session_ids[1]
    ) THEN
      RAISE EXCEPTION 'quote:invalid-session';
    END IF;

    RETURN p_selected_session_ids;
  END IF;

  RETURN COALESCE(p_selected_session_ids, '{}'::uuid[]);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_registration_session_ids(uuid, uuid, uuid, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_registration_session_ids(uuid, uuid, uuid, text, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_registration_session_ids(uuid, uuid, uuid, text, uuid[]) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3) Lock compute_program_registration_quote — internal only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.compute_program_registration_quote(uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_program_registration_quote(uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.compute_program_registration_quote(uuid, uuid, uuid, uuid, uuid, uuid, uuid[], jsonb) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 4) Public customer APIs remain available to authenticated users
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.quote_program_registration(uuid, uuid, uuid, uuid, uuid, uuid[], jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_for_program(
  uuid, uuid, uuid, uuid, uuid[], text, text, text, text, text, boolean, boolean, text, uuid, numeric, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Verification — run after applying this script
-- ---------------------------------------------------------------------------
-- Expected single-row result:
--   quote_snapshot_column_exists              = true
--   resolve_fn_exists                         = true
--   anon_can_execute_compute                  = false
--   authenticated_can_execute_compute         = false
--   authenticated_can_execute_quote           = true
--   authenticated_can_execute_register        = true
--
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'program_enrollments'
      AND column_name = 'quote_snapshot'
  ) AS quote_snapshot_column_exists,
  to_regprocedure(
    'public.resolve_registration_session_ids(uuid,uuid,uuid,text,uuid[])'
  ) IS NOT NULL AS resolve_fn_exists,
  has_function_privilege(
    'anon',
    'public.compute_program_registration_quote(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)',
    'EXECUTE'
  ) AS anon_can_execute_compute,
  has_function_privilege(
    'authenticated',
    'public.compute_program_registration_quote(uuid,uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)',
    'EXECUTE'
  ) AS authenticated_can_execute_compute,
  has_function_privilege(
    'authenticated',
    'public.quote_program_registration(uuid,uuid,uuid,uuid,uuid,uuid[],jsonb)',
    'EXECUTE'
  ) AS authenticated_can_execute_quote,
  has_function_privilege(
    'authenticated',
    'public.register_for_program(uuid,uuid,uuid,uuid,uuid[],text,text,text,text,text,boolean,boolean,text,uuid,numeric,text)',
    'EXECUTE'
  ) AS authenticated_can_execute_register;
