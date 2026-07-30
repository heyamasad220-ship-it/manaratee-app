-- Venue rental payment ledger fields (Payments redesign phases 8–12).
-- Adds method/reference/recorder/receipt columns, expands type/status CHECKs,
-- and idempotency index for online provider payment IDs.
-- Run after 046_venue_rentals_workflow.sql (and any later rental_payments alters).

ALTER TABLE public.rental_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

COMMENT ON COLUMN public.rental_payments.payment_method IS
  'How funds were collected: cash, check, ach, card_terminal, online, other.';
COMMENT ON COLUMN public.rental_payments.reference_number IS
  'Check number, terminal auth code, or external reference.';
COMMENT ON COLUMN public.rental_payments.recorded_by IS
  'Staff user who recorded a manual payment or charge.';
COMMENT ON COLUMN public.rental_payments.receipt_url IS
  'Optional uploaded or generated receipt URL.';

-- Expand payment_type CHECK (keep legacy values).
ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_payment_type_check;

ALTER TABLE public.rental_payments
  ADD CONSTRAINT rental_payments_payment_type_check CHECK (
    payment_type IN (
      'deposit',
      'security_deposit',
      'remaining_balance',
      'addon_fee',
      'refund',
      'installment',
      'cleaning_fee',
      'credit',
      'adjustment',
      'discount'
    )
  );

-- Expand status CHECK (keep legacy values; map in app for display).
ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_status_check;

ALTER TABLE public.rental_payments
  ADD CONSTRAINT rental_payments_status_check CHECK (
    status IN (
      'unpaid',
      'payment_requested',
      'paid_manually',
      'paid_stripe_later',
      'refunded',
      'pending',
      'completed',
      'failed',
      'voided',
      'partially_refunded'
    )
  );

ALTER TABLE public.rental_payments
  DROP CONSTRAINT IF EXISTS rental_payments_payment_method_check;

ALTER TABLE public.rental_payments
  ADD CONSTRAINT rental_payments_payment_method_check CHECK (
    payment_method IS NULL
    OR payment_method IN (
      'cash',
      'check',
      'ach',
      'card_terminal',
      'online',
      'other'
    )
  );

-- Prevent duplicate online provider settlements.
CREATE UNIQUE INDEX IF NOT EXISTS rental_payments_stripe_payment_intent_uidx
  ON public.rental_payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
