-- Internal event location modes: facility | online | external
-- Facility keeps venue_id + facility setup / calendar reservation.
-- Online / external clear venue_id and do not occupy facility calendar.
-- Run after 209_shared_scheduling_foundation.sql

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS location_type TEXT,
  ADD COLUMN IF NOT EXISTS location_address TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'internal_events_location_type_check'
  ) THEN
    ALTER TABLE public.internal_events
      ADD CONSTRAINT internal_events_location_type_check
      CHECK (
        location_type IS NULL
        OR location_type IN ('facility', 'online', 'external')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.internal_events.location_type IS
  'facility = org venue (calendar + facility setup); online = virtual; external = off-site name/address. NULL = legacy unset.';

COMMENT ON COLUMN public.internal_events.location_address IS
  'Street/city address for external venues. Null for facility and online.';

-- Only occupy shared facility calendar when a venue is selected
CREATE OR REPLACE FUNCTION public.sync_internal_event_to_resource()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setup INTEGER := 0;
  v_cleanup INTEGER := 0;
  v_event_end TIMESTAMPTZ;
  v_occupied_start TIMESTAMPTZ;
  v_occupied_end TIMESTAMPTZ;
  v_reservation_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'internal_event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Replace calendar row (delete + insert). Do not use ON CONFLICT (organization_id, source_type, source_id)
  -- — after multi-venue migration that unique index no longer applies to internal_event rows.
  DELETE FROM public.resource_reservations
  WHERE source_type = 'internal_event' AND source_id = NEW.id;

  -- No facility venue → no calendar block (online / external / unset)
  IF NEW.venue_id IS NULL
     OR NEW.start_at IS NULL
     OR NEW.status IN ('cancelled', 'declined', 'draft') THEN
    RETURN NEW;
  END IF;

  v_setup := COALESCE(NEW.setup_minutes, 0);
  v_cleanup := COALESCE(NEW.cleanup_minutes, 0);
  v_event_end := COALESCE(NEW.end_at, NEW.start_at + INTERVAL '1 hour');
  v_occupied_start := NEW.start_at - make_interval(mins => v_setup);
  v_occupied_end := v_event_end + make_interval(mins => v_cleanup);

  v_reservation_status := CASE
    WHEN NEW.status IN ('submitted', 'awaiting_approval') THEN 'temporary_hold'
    WHEN NEW.status IN ('approved', 'confirmed', 'scheduled', 'completed') THEN 'confirmed'
    ELSE 'temporary_hold'
  END;

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
    NEW.location_label,
    NEW.name,
    NEW.description,
    v_occupied_start,
    v_occupied_end,
    'internal_event',
    NEW.id,
    v_reservation_status,
    jsonb_build_object(
      'department_id', NEW.department_id,
      'event_type_id', NEW.event_type_id,
      'internal_event_status', NEW.status,
      'location_type', NEW.location_type,
      'event_start_at', NEW.start_at,
      'event_end_at', v_event_end,
      'setup_minutes', v_setup,
      'cleanup_minutes', v_cleanup
    )
  );

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
