-- Drop empty legacy donation / import / settings tables superseded by canonical ledger.
-- Run after 139_stripe_connect_donations.sql
--
-- Tier 1 (empty, no app reads): donation_payments, donation_pledges, donation_amount_options,
-- donor_import_*, contact_import_staging, organization_settings.
--
-- Apply:
--   npx supabase db query --linked -f scripts/140_drop_legacy_donation_and_staging_tables.sql
--
-- Before Tier 2 drops (payment_import_rows, backup_*), export with:
--   node scripts/cleanup-legacy-donation-staging-tables.mjs
-- Then apply scripts/141_drop_payment_import_rows_and_backup_tables.sql

DROP TABLE IF EXISTS public.donation_payments CASCADE;
DROP TABLE IF EXISTS public.donation_pledges CASCADE;
DROP TABLE IF EXISTS public.donation_amount_options CASCADE;
DROP TABLE IF EXISTS public.donor_import_rows CASCADE;
DROP TABLE IF EXISTS public.donor_import_batches CASCADE;
DROP TABLE IF EXISTS public.contact_import_staging CASCADE;
DROP TABLE IF EXISTS public.organization_settings CASCADE;
