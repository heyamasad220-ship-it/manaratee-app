-- Backfill setup/cleanup buffers on existing rental_reservations + restore calendar expansion.
--
-- Prerequisites: run scripts/222_venue_rental_setup_cleanup_buffers.sql first
-- (and 209 + 218 for shared scheduling / sync fix).
--
-- Why the function replace: scripts/218_fix_venue_rental_reservation_sync.sql
-- switched to delete+insert but omitted setup/cleanup expansion from 209.
-- This restores expansion while keeping the 218-safe delete+insert pattern.
--
-- Safe to re-run. Applies current org default → venue override to every
-- rental_reservations row (cancelled times unchanged). Calendar rows refresh
-- via the AFTER UPDATE trigger.

-- ---------------------------------------------------------------------------
-- 1) Sync: delete+insert with occupied window = event ± buffers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_rental_reservation_to_resource()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setup INTEGER := 0;
  v_cleanup INTEGER := 0;
  v_title TEXT := 'Venue Rental';
  v_occupied_start TIMESTAMPTZ;
  v_occupied_end TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'venue_rental' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM public.resource_reservations
  WHERE source_type = 'venue_rental' AND source_id = NEW.id;

  IF NEW.status IN ('cancelled', 'expired') THEN
    RETURN NEW;
  END IF;

  v_setup := COALESCE(NEW.setup_minutes, 0);
  v_cleanup := COALESCE(NEW.cleanup_minutes, 0);
  v_occupied_start := NEW.start_at - make_interval(mins => v_setup);
  v_occupied_end := NEW.end_at + make_interval(mins => v_cleanup);

  SELECT COALESCE(et.name, 'Venue Rental')
  INTO v_title
  FROM public.venue_rentals vr
  LEFT JOIN public.venue_rental_event_types et
    ON et.id = vr.venue_rental_event_type_id
  WHERE vr.id = NEW.venue_rental_id;

  IF v_title IS NULL OR btrim(v_title) = '' THEN
    v_title := 'Venue Rental';
  END IF;

  INSERT INTO public.resource_reservations (
    organization_id,
    venue_id,
    space_label,
    title,
    description,
    start_at,
    end_at,
    source_type,
    source_id,
    status,
    hold_expires_at,
    created_by,
    metadata
  )
  VALUES (
    NEW.organization_id,
    NEW.venue_id,
    NULL,
    v_title,
    NULL,
    v_occupied_start,
    v_occupied_end,
    'venue_rental',
    NEW.id,
    NEW.status,
    NEW.hold_expires_at,
    NEW.created_by,
    jsonb_build_object(
      'sync_origin', 'venue_rental_reservation',
      'venue_rental_id', NEW.venue_rental_id,
      'rental_reservation_id', NEW.id,
      'event_start_at', NEW.start_at,
      'event_end_at', NEW.end_at,
      'setup_minutes', v_setup,
      'cleanup_minutes', v_cleanup
    )
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Stamp buffers: venue override → org default → 0
-- ---------------------------------------------------------------------------
UPDATE public.rental_reservations rr
SET
  setup_minutes = GREATEST(
    0,
    LEAST(
      24 * 60,
      COALESCE(v.setup_minutes, s.default_setup_minutes, 0)
    )
  ),
  cleanup_minutes = GREATEST(
    0,
    LEAST(
      24 * 60,
      COALESCE(v.cleanup_minutes, s.default_cleanup_minutes, 0)
    )
  ),
  updated_at = NOW()
FROM public.venues v
LEFT JOIN public.venue_rental_settings s
  ON s.organization_id = v.organization_id
WHERE rr.venue_id = v.id
  AND rr.organization_id = v.organization_id;

NOTIFY pgrst, 'reload schema';
