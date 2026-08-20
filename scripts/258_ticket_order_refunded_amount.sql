-- Partial ticket refunds: track money returned without always voiding seats.
-- Run after 257_events_checkin_permission.sql. Safe to re-run.

ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.ticket_orders
  DROP CONSTRAINT IF EXISTS ticket_orders_refunded_amount_cents_check;

ALTER TABLE public.ticket_orders
  ADD CONSTRAINT ticket_orders_refunded_amount_cents_check
  CHECK (refunded_amount_cents >= 0);

COMMENT ON COLUMN public.ticket_orders.refunded_amount_cents IS
  'Total cents refunded on this order. Partial refunds keep seats valid until remaining is $0.';

UPDATE public.ticket_orders
SET refunded_amount_cents = total_cents
WHERE status = 'refunded'
  AND COALESCE(refunded_amount_cents, 0) = 0
  AND total_cents > 0;

NOTIFY pgrst, 'reload schema';
