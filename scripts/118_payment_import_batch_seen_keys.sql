-- Track duplicate keys across chunked payment CSV imports (cleared when import completes).
-- Run after 117_payment_import_match_foundation.sql

ALTER TABLE public.payment_import_batches
  ADD COLUMN IF NOT EXISTS import_seen_keys jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.payment_import_batches.import_seen_keys IS
  'Temporary duplicate-key cache while a CSV import is processing; reset after completion.';
