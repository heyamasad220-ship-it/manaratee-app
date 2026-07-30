-- Multi-venue support for internal events (facility requests / create).
-- Run after 210_internal_event_location_type.sql

CREATE TABLE IF NOT EXISTS public.internal_event_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  internal_event_id UUID NOT NULL REFERENCES public.internal_events(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (internal_event_id, venue_id)
);

CREATE INDEX IF NOT EXISTS internal_event_venues_org_event_idx
  ON public.internal_event_venues(organization_id, internal_event_id);

CREATE INDEX IF NOT EXISTS internal_event_venues_org_venue_idx
  ON public.internal_event_venues(organization_id, venue_id);

ALTER TABLE public.internal_event_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage internal event venues"
  ON public.internal_event_venues;
CREATE POLICY "Org members manage internal event venues"
  ON public.internal_event_venues FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.internal_event_venues IS
  'Spaces booked for an internal event. internal_events.venue_id remains the primary (first) venue for joins.';

-- Allow multiple facility calendar rows per event (one per venue)
DROP INDEX IF EXISTS public.resource_reservations_synced_source_idx;

CREATE UNIQUE INDEX IF NOT EXISTS resource_reservations_synced_source_idx
  ON public.resource_reservations(organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL AND source_type IS DISTINCT FROM 'internal_event';

CREATE UNIQUE INDEX IF NOT EXISTS resource_reservations_internal_event_venue_idx
  ON public.resource_reservations(organization_id, source_type, source_id, venue_id)
  WHERE source_id IS NOT NULL
    AND source_type = 'internal_event'
    AND venue_id IS NOT NULL;

-- Sync: one resource_reservations row per linked venue (or legacy venue_id)
-- IMPORTANT: the live trigger calls sync_internal_event_reservation (see 040).
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

  -- Legacy fallback: single venue_id when junction empty
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

-- Also install under the alternate name used by scripts 210/212 (identical body via 213).
-- Prefer running 213_fix_internal_event_reservation_trigger.sql on existing databases.

-- Backfill junction from existing venue_id
INSERT INTO public.internal_event_venues (organization_id, internal_event_id, venue_id)
SELECT organization_id, id, venue_id
FROM public.internal_events
WHERE venue_id IS NOT NULL
ON CONFLICT (internal_event_id, venue_id) DO NOTHING;

-- Re-sync facility calendar rows
UPDATE public.internal_events
SET updated_at = NOW()
WHERE start_at IS NOT NULL
  AND status IS DISTINCT FROM 'cancelled';

NOTIFY pgrst, 'reload schema';
