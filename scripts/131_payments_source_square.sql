-- Allow Square terminal batch deposits on payments.source
-- Run before clean-mas-ledger-square-batch.mjs if using source = 'square'

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
      'import',
      'manual'
    )
  );

COMMENT ON COLUMN public.payments.source IS
  'Payment channel key. square = Square terminal batch deposit (campaign-level, not a donor).';
