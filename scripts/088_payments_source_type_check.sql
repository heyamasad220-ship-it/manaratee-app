-- Expand payments.source_type to support all canonical donation entry paths.
-- Run in Supabase SQL Editor after 087_org_user_support_access.sql
--
-- Before (typical): CHECK (source_type IN ('manual')) or similar narrow set
-- After: manual | import | portal | processor

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_source_type_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_source_type_check
  CHECK (
    source_type IN ('manual', 'import', 'portal', 'processor')
  );

COMMENT ON COLUMN public.payments.source_type IS
  'How the payment was recorded: manual (staff UI), import (CSV promote), portal (customer), processor (payment gateway).';
