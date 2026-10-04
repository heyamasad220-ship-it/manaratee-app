-- Allow ACH and Intuit on payments.source

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_source_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_source_check
  CHECK (
    source IN (
      'cash',
      'check',
      'square',
      'zelle',
      'venmo',
      'paypal',
      'stripe',
      'ach',
      'intuit',
      'import',
      'manual'
    )
  );

COMMENT ON COLUMN public.payments.source IS
  'Payment channel key: cash, check, square, zelle, venmo, paypal, stripe, ach, intuit, import, or manual.';
