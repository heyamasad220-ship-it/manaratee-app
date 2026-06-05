-- Phase 2B smoke test (read-only)
-- Run in Supabase SQL Editor after migrations 020–023.
-- Each section should return rows with status = 'PASS'.

-- ---------------------------------------------------------------------------
-- 0) Schema + RPC presence (migration banners off when these exist)
-- ---------------------------------------------------------------------------
SELECT 'schema_rpc' AS check_id,
  CASE
    WHEN to_regclass('public.program_charges') IS NOT NULL
      AND to_regclass('public.program_charge_lines') IS NOT NULL
      AND to_regclass('public.program_charge_schedule') IS NOT NULL
      AND to_regclass('public.program_offering_billing_periods') IS NOT NULL
      AND to_regprocedure('public.void_program_charge_line(uuid,uuid,text)') IS NOT NULL
      AND to_regprocedure('public.adjust_program_charge_line(uuid,uuid,numeric,numeric,numeric,text)') IS NOT NULL
      AND to_regprocedure('public.add_program_charge_line(uuid,uuid,text,text,numeric,numeric,text)') IS NOT NULL
      AND to_regprocedure('public.staff_ensure_enrollment_charge(uuid,uuid)') IS NOT NULL
      AND to_regprocedure('public.staff_backfill_enrollment_charges(uuid,integer)') IS NOT NULL
      AND to_regprocedure('public.sync_offering_billing_periods(uuid,uuid,numeric,integer)') IS NOT NULL
    THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  jsonb_build_object(
    'program_charges', to_regclass('public.program_charges') IS NOT NULL,
    'program_charge_lines', to_regclass('public.program_charge_lines') IS NOT NULL,
    'program_charge_schedule', to_regclass('public.program_charge_schedule') IS NOT NULL,
    'billing_periods', to_regclass('public.program_offering_billing_periods') IS NOT NULL,
    'void_line', to_regprocedure('public.void_program_charge_line(uuid,uuid,text)') IS NOT NULL,
    'adjust_line', to_regprocedure('public.adjust_program_charge_line(uuid,uuid,numeric,numeric,numeric,text)') IS NOT NULL,
    'add_line', to_regprocedure('public.add_program_charge_line(uuid,uuid,text,text,numeric,numeric,text)') IS NOT NULL,
    'ensure_charge', to_regprocedure('public.staff_ensure_enrollment_charge(uuid,uuid)') IS NOT NULL,
    'backfill', to_regprocedure('public.staff_backfill_enrollment_charges(uuid,integer)') IS NOT NULL,
    'sync_periods', to_regprocedure('public.sync_offering_billing_periods(uuid,uuid,numeric,integer)') IS NOT NULL
  ) AS details;

-- ---------------------------------------------------------------------------
-- 1) New registrations auto-linked to charge + lines
-- ---------------------------------------------------------------------------
SELECT 'auto_charge_on_register' AS check_id,
  CASE
    WHEN COUNT(*) FILTER (WHERE e.charge_id IS NOT NULL) > 0
      AND COUNT(*) FILTER (
        WHERE e.charge_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.program_charge_lines l
            WHERE l.charge_id = e.charge_id
          )
      ) > 0
    THEN 'PASS'
    WHEN COUNT(*) = 0 THEN 'SKIP'
    ELSE 'FAIL'
  END AS status,
  jsonb_build_object(
    'enrollments_total', COUNT(*),
    'with_charge_id', COUNT(*) FILTER (WHERE e.charge_id IS NOT NULL),
    'with_charge_lines', COUNT(*) FILTER (
      WHERE e.charge_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.program_charge_lines l WHERE l.charge_id = e.charge_id
        )
    ),
    'sample_enrollment_ids', (
      SELECT COALESCE(jsonb_agg(sub.id), '[]'::jsonb)
      FROM (
        SELECT e2.id
        FROM public.program_enrollments e2
        WHERE e2.charge_id IS NOT NULL
        ORDER BY e2.created_at DESC NULLS LAST
        LIMIT 3
      ) sub
    )
  ) AS details
FROM public.program_enrollments e
WHERE e.status NOT IN ('cancelled', 'canceled', 'withdrawn', 'transferred', 'expired');

-- ---------------------------------------------------------------------------
-- 2) Billing calendar loads for offerings with dates
-- ---------------------------------------------------------------------------
SELECT 'billing_schedule_periods' AS check_id,
  CASE
    WHEN COUNT(*) FILTER (WHERE o.start_date IS NOT NULL AND o.end_date IS NOT NULL) = 0
      THEN 'SKIP'
    WHEN COUNT(*) FILTER (
      WHERE o.start_date IS NOT NULL
        AND o.end_date IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.program_offering_billing_periods p
          WHERE p.offering_id = o.id
        )
    ) > 0
      THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  jsonb_build_object(
    'offerings_with_dates', COUNT(*) FILTER (WHERE o.start_date IS NOT NULL AND o.end_date IS NOT NULL),
    'offerings_with_periods', COUNT(*) FILTER (
      WHERE o.start_date IS NOT NULL
        AND o.end_date IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.program_offering_billing_periods p WHERE p.offering_id = o.id
        )
    ),
    'sample_offering_ids', (
      SELECT COALESCE(jsonb_agg(sub.id), '[]'::jsonb)
      FROM (
        SELECT o2.id
        FROM public.program_offerings o2
        WHERE o2.start_date IS NOT NULL AND o2.end_date IS NOT NULL
        ORDER BY o2.created_at DESC NULLS LAST
        LIMIT 3
      ) sub
    )
  ) AS details
FROM public.program_offerings o;

-- ---------------------------------------------------------------------------
-- 3) Charge line admin RPCs callable (dry-run via regprocedure only)
-- ---------------------------------------------------------------------------
SELECT 'charge_line_admin_rpcs' AS check_id,
  CASE
    WHEN to_regprocedure('public.void_program_charge_line(uuid,uuid,text)') IS NOT NULL
      AND to_regprocedure('public.adjust_program_charge_line(uuid,uuid,numeric,numeric,numeric,text)') IS NOT NULL
      AND to_regprocedure('public.add_program_charge_line(uuid,uuid,text,text,numeric,numeric,text)') IS NOT NULL
      AND to_regprocedure('public.recalculate_program_charge_from_lines(uuid,uuid)') IS NOT NULL
    THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  jsonb_build_object(
    'void', to_regprocedure('public.void_program_charge_line(uuid,uuid,text)') IS NOT NULL,
    'adjust', to_regprocedure('public.adjust_program_charge_line(uuid,uuid,numeric,numeric,numeric,text)') IS NOT NULL,
    'add', to_regprocedure('public.add_program_charge_line(uuid,uuid,text,text,numeric,numeric,text)') IS NOT NULL,
    'recalculate', to_regprocedure('public.recalculate_program_charge_from_lines(uuid,uuid)') IS NOT NULL
  ) AS details;

-- ---------------------------------------------------------------------------
-- 4) Legacy backfill — enrollments missing charge_id but with quote_snapshot
-- ---------------------------------------------------------------------------
SELECT 'legacy_backfill_candidates' AS check_id,
  CASE
    WHEN to_regprocedure('public.staff_backfill_enrollment_charges(uuid,integer)') IS NULL
      THEN 'FAIL'
    WHEN COUNT(*) = 0
      THEN 'PASS'
    ELSE 'WARN'
  END AS status,
  jsonb_build_object(
    'legacy_without_charge', COUNT(*),
    'with_quote_snapshot', COUNT(*) FILTER (WHERE e.quote_snapshot IS NOT NULL),
    'hint', 'Run staff_backfill_enrollment_charges(org_id, 200) or use Create Charge Ledger on registration detail'
  ) AS details
FROM public.program_enrollments e
WHERE e.charge_id IS NULL
  AND e.status NOT IN ('cancelled', 'canceled', 'withdrawn', 'transferred', 'expired');

-- ---------------------------------------------------------------------------
-- 5) Summary row
-- ---------------------------------------------------------------------------
SELECT 'SUMMARY' AS check_id,
  CASE
    WHEN (
      SELECT COUNT(*) FROM (
        SELECT 1 WHERE to_regclass('public.program_charges') IS NULL
        UNION ALL SELECT 1 WHERE to_regprocedure('public.staff_backfill_enrollment_charges(uuid,integer)') IS NULL
        UNION ALL SELECT 1 WHERE to_regprocedure('public.sync_offering_billing_periods(uuid,uuid,numeric,integer)') IS NULL
      ) missing
    ) = 0
    THEN 'PASS — migrations 020–023 appear applied; UI should not show amber migration banner'
    ELSE 'FAIL — run scripts/020 through 023 in Supabase SQL Editor'
  END AS status,
  NULL::jsonb AS details;
