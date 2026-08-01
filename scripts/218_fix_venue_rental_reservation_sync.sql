-- Fix venue rental reservation calendar sync after multi-venue index change (211+).
--
-- Root cause: resource_reservations_synced_source_idx is now
--   (organization_id, source_type, source_id)
--   WHERE source_id IS NOT NULL AND source_type IS DISTINCT FROM 'internal_event'
-- but sync_rental_reservation_to_resource() still used
--   ON CONFLICT (organization_id, source_type, source_id) WHERE source_id IS NOT NULL
-- which no longer matches → Postgres error:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Same class of bug as scripts/213_fix_internal_event_reservation_trigger.sql.
-- Run in Supabase SQL Editor (safe to re-run).

DROP INDEX IF EXISTS public.resource_reservations_synced_source_idx;

CREATE UNIQUE INDEX IF NOT EXISTS resource_reservations_synced_source_idx
  ON public.resource_reservations(organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL AND source_type IS DISTINCT FROM 'internal_event';

CREATE UNIQUE INDEX IF NOT EXISTS resource_reservations_internal_event_venue_idx
  ON public.resource_reservations(organization_id, source_type, source_id, venue_id)
  WHERE source_id IS NOT NULL
    AND source_type = 'internal_event'
    AND venue_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_rental_reservation_to_resource()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'venue_rental' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Replace calendar row (delete + insert). Do not use ON CONFLICT on
  -- (organization_id, source_type, source_id) — the unique index predicate
  -- excludes internal_event and no longer matches that ON CONFLICT target.
  DELETE FROM public.resource_reservations
  WHERE source_type = 'venue_rental' AND source_id = NEW.id;

  IF NEW.status IN ('cancelled', 'expired') THEN
    RETURN NEW;
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
    'Venue Rental Hold',
    NULL,
    NEW.start_at,
    NEW.end_at,
    'venue_rental',
    NEW.id,
    NEW.status,
    NEW.hold_expires_at,
    NEW.created_by,
    jsonb_build_object(
      'sync_origin', 'venue_rental_reservation',
      'venue_rental_id', NEW.venue_rental_id,
      'rental_reservation_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

-- Legacy venue_bookings sync hits the same ON CONFLICT mismatch.
CREATE OR REPLACE FUNCTION public.sync_venue_booking_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bounds RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'venue_rental' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM public.resource_reservations
  WHERE source_type = 'venue_rental' AND source_id = NEW.id;

  IF NEW.status IN ('cancelled', 'rejected') OR NEW.event_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_bounds
  FROM public.venue_booking_bounds(NEW.event_date, NEW.start_time, NEW.end_time);

  IF v_bounds.start_at IS NULL THEN
    RETURN NEW;
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
    metadata
  )
  VALUES (
    NEW.organization_id,
    NEW.venue_id,
    NULL,
    COALESCE(NULLIF(NEW.event_type, ''), 'Venue Rental'),
    NEW.notes,
    v_bounds.start_at,
    v_bounds.end_at,
    'venue_rental',
    NEW.id,
    NEW.status,
    jsonb_build_object(
      'sync_origin', 'legacy_venue_booking',
      'legacy_venue_booking_id', NEW.id,
      'guest_count', NEW.guest_count,
      'user_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
