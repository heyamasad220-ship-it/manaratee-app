-- Venue rental setup / cleanup buffers (multi-tenant defaults).
-- Occupied calendar window = event start − setup … event end + cleanup
-- (sync expansion restored in scripts/223 after 218's delete+insert fix).
-- Safe to re-run.

-- Org defaults (Venue Rentals → Settings → General)
ALTER TABLE public.venue_rental_settings
  ADD COLUMN IF NOT EXISTS default_setup_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (default_setup_minutes >= 0 AND default_setup_minutes <= 24 * 60),
  ADD COLUMN IF NOT EXISTS default_cleanup_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (default_cleanup_minutes >= 0 AND default_cleanup_minutes <= 24 * 60);

COMMENT ON COLUMN public.venue_rental_settings.default_setup_minutes IS
  'Default buffer minutes before each rental slot start (setup). Applied to new rental_reservations unless the venue overrides.';

COMMENT ON COLUMN public.venue_rental_settings.default_cleanup_minutes IS
  'Default buffer minutes after each rental slot end (cleanup/teardown). Applied to new rental_reservations unless the venue overrides.';

-- Optional per-space overrides (NULL = inherit org default)
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS setup_minutes INTEGER
    CHECK (setup_minutes IS NULL OR (setup_minutes >= 0 AND setup_minutes <= 24 * 60)),
  ADD COLUMN IF NOT EXISTS cleanup_minutes INTEGER
    CHECK (cleanup_minutes IS NULL OR (cleanup_minutes >= 0 AND cleanup_minutes <= 24 * 60));

COMMENT ON COLUMN public.venues.setup_minutes IS
  'Optional setup buffer override in minutes. NULL inherits venue_rental_settings.default_setup_minutes.';

COMMENT ON COLUMN public.venues.cleanup_minutes IS
  'Optional cleanup buffer override in minutes. NULL inherits venue_rental_settings.default_cleanup_minutes.';

NOTIFY pgrst, 'reload schema';
