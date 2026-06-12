-- Replace internal/external tags with a bookings availability toggle
-- Run after 068_venue_usage_tags_and_pricing.sql
-- Safe to re-run

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS available_for_bookings BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.venues.available_for_bookings IS
  'When true, space appears in Venue Rentals / customer booking flows. All active spaces remain available for Event Management and Programs.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'usage_tag'
  ) THEN
    UPDATE public.venues
    SET available_for_bookings = true
    WHERE usage_tag = 'external';

    UPDATE public.venues
    SET available_for_bookings = false
    WHERE usage_tag IS DISTINCT FROM 'external';
  END IF;
END $$;
