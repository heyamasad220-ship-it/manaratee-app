-- Drop legacy CSV row staging and May 2026 backup snapshot tables.
-- Run ONLY after exporting archives:
--   node scripts/cleanup-legacy-donation-staging-tables.mjs
--   node scripts/cleanup-legacy-donation-staging-tables.mjs --execute
--
-- Apply:
--   npx supabase db query --linked -f scripts/141_drop_payment_import_rows_and_backup_tables.sql
--
-- Keeps payment_import_batches (import history metadata) and canonical payments ledger.

DROP TABLE IF EXISTS public.payment_import_rows CASCADE;

DROP TABLE IF EXISTS public.backup_donation_payments_2026_05_24 CASCADE;
DROP TABLE IF EXISTS public.backup_donation_pledges_2026_05_24 CASCADE;
DROP TABLE IF EXISTS public.backup_donors_2026_05_24 CASCADE;
DROP TABLE IF EXISTS public.backup_payments_2026_05_24 CASCADE;
DROP TABLE IF EXISTS public.backup_pledges_2026_05_24 CASCADE;
