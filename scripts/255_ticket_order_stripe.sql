-- Stripe identifiers on ticket orders (public paid checkout via Connect).
-- Run after 254_event_documents.sql. Safe to re-run.

ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_orders_stripe_checkout_session_uidx
  ON public.ticket_orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_orders_stripe_payment_intent_uidx
  ON public.ticket_orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

COMMENT ON COLUMN public.ticket_orders.stripe_checkout_session_id IS
  'Stripe Checkout Session id for public paid ticket orders.';

NOTIFY pgrst, 'reload schema';
