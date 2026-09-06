-- Remove imported program transaction-fee add-on charges from the ledger.
-- These were $5 (or family multiples) processing fees stored as addon charges,
-- mainly Sunday School 2026-2027. They are not purchased extras (lunch, care,
-- materials). Tuition / registration charges are left alone.
--
-- Cascades to program_charge_lines, program_charge_schedule, and
-- program_payment_allocations. Enrollments do not point at these charges.

WITH txn_charges AS (
  SELECT c.id
  FROM public.program_charges c
  WHERE c.charge_type = 'addon'
    AND (
      lower(coalesce(c.quote_snapshot->>'type', '')) = 'transaction_fee'
      OR lower(coalesce(c.metadata->>'addon_kind', '')) = 'transaction_fee'
      OR lower(coalesce(c.metadata->>'label', '')) LIKE '%transaction%'
      OR EXISTS (
        SELECT 1
        FROM public.program_charge_lines l
        WHERE l.charge_id = c.id
          AND (
            lower(coalesce(l.line_type, '')) = 'transaction_fee'
            OR lower(coalesce(l.metadata->>'addon_kind', '')) = 'transaction_fee'
            OR lower(coalesce(l.label, '')) LIKE '%transaction%'
          )
      )
    )
),
deleted AS (
  DELETE FROM public.program_charges c
  WHERE c.id IN (SELECT id FROM txn_charges)
  RETURNING c.id, c.total
)
SELECT
  COUNT(*) AS deleted_charges,
  COALESCE(SUM(total), 0)::numeric(12, 2) AS deleted_total
FROM deleted;
