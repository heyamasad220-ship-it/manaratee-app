-- Venue usage tags (internal vs external) and peak / non-peak pricing
-- Run after 067_module_catalog_and_bundles.sql
-- Safe to re-run

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS usage_tag TEXT NOT NULL DEFAULT 'internal';

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS peak_flat_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS peak_hourly_rate NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS availability_start TIME;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS availability_end TIME;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_usage_tag_check'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_usage_tag_check
      CHECK (usage_tag IN ('internal', 'external'));
  END IF;
END $$;

COMMENT ON COLUMN public.venues.usage_tag IS
  'internal = Event Management and Programs; external = Venue Rentals (customer-facing).';

COMMENT ON COLUMN public.venues.base_price IS
  'Non-peak flat fee (Mon–Thu default).';

COMMENT ON COLUMN public.venues.hourly_rate IS
  'Non-peak hourly rate (Mon–Thu default).';

COMMENT ON COLUMN public.venues.peak_flat_price IS
  'Peak flat fee (Fri–Sun default).';

COMMENT ON COLUMN public.venues.peak_hourly_rate IS
  'Peak hourly rate (Fri–Sun default).';

-- Seed peak pricing from existing non-peak values when unset
UPDATE public.venues
SET
  peak_flat_price = CASE
    WHEN peak_flat_price IS NULL OR peak_flat_price = 0 THEN COALESCE(base_price, 0)
    ELSE peak_flat_price
  END,
  peak_hourly_rate = CASE
    WHEN peak_hourly_rate IS NULL OR peak_hourly_rate = 0 THEN COALESCE(hourly_rate, 0)
    ELSE peak_hourly_rate
  END
WHERE peak_flat_price = 0 OR peak_hourly_rate = 0;
