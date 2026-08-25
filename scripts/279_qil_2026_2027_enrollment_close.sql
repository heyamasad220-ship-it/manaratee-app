-- QIL 2026–2027: keep registration open through 12/31/2026 on the year
-- program and every offering. Offerings do not inherit dates, so most
-- still had enrollment_close_date of 2026-08-16 or 2026-08-17 (Registration closed).
-- Idempotent. Targets the year by name so it is safe to re-run.

UPDATE public.programs
SET
  enrollment_close_date = '2026-12-31',
  updated_at = NOW()
WHERE name = 'QIL 2026-2027';

UPDATE public.program_offerings AS o
SET
  enrollment_close_date = '2026-12-31',
  updated_at = NOW()
FROM public.programs AS p
WHERE o.program_id = p.id
  AND p.name = 'QIL 2026-2027';
