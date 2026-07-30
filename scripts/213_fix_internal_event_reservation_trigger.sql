-- Root cause: trigger internal_events_reservation_sync calls
-- sync_internal_event_reservation(), which still used
-- ON CONFLICT (organization_id, source_type, source_id).
-- Migrations 210–212 only replaced sync_internal_event_to_resource() (not used by the trigger).
--
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

CREATE OR REPLACE FUNCTION public.sync_internal_event_reservation()
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
  v_venue RECORD;
  v_has_venues BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'internal_event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM public.resource_reservations
  WHERE source_type = 'internal_event' AND source_id = NEW.id;

  IF NEW.start_at IS NULL
     OR NEW.status IN ('cancelled', 'declined', 'draft') THEN
    RETURN NEW;
  END IF;

  IF NEW.venue_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.internal_event_venues iev
       WHERE iev.internal_event_id = NEW.id
     ) THEN
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

  FOR v_venue IN
    SELECT iev.venue_id, v.name AS venue_name
    FROM public.internal_event_venues iev
    JOIN public.venues v ON v.id = iev.venue_id
    WHERE iev.internal_event_id = NEW.id
    ORDER BY v.name
  LOOP
    v_has_venues := TRUE;
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
      v_venue.venue_id,
      COALESCE(NEW.location_label, v_venue.venue_name),
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
  END LOOP;

  IF NOT v_has_venues AND NEW.venue_id IS NOT NULL THEN
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
  END IF;

  RETURN NEW;
END;
$$;

-- Same body under the alternate name used by scripts 210–212
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
  v_venue RECORD;
  v_has_venues BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'internal_event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  DELETE FROM public.resource_reservations
  WHERE source_type = 'internal_event' AND source_id = NEW.id;

  IF NEW.start_at IS NULL
     OR NEW.status IN ('cancelled', 'declined', 'draft') THEN
    RETURN NEW;
  END IF;

  IF NEW.venue_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.internal_event_venues iev
       WHERE iev.internal_event_id = NEW.id
     ) THEN
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

  FOR v_venue IN
    SELECT iev.venue_id, v.name AS venue_name
    FROM public.internal_event_venues iev
    JOIN public.venues v ON v.id = iev.venue_id
    WHERE iev.internal_event_id = NEW.id
    ORDER BY v.name
  LOOP
    v_has_venues := TRUE;
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
      v_venue.venue_id,
      COALESCE(NEW.location_label, v_venue.venue_name),
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
  END LOOP;

  IF NOT v_has_venues AND NEW.venue_id IS NOT NULL THEN
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS internal_events_reservation_sync ON public.internal_events;
CREATE TRIGGER internal_events_reservation_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.internal_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_internal_event_reservation();

DROP TRIGGER IF EXISTS internal_events_resource_sync ON public.internal_events;

NOTIFY pgrst, 'reload schema';
