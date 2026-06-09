-- Link internal events to venues + sync venue_id into resource_reservations
-- Run after 040_resource_reservations.sql

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS internal_events_org_venue_idx
  ON public.internal_events(organization_id, venue_id);

CREATE OR REPLACE FUNCTION public.sync_internal_event_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'internal_event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.start_at IS NULL OR NEW.status = 'cancelled' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'internal_event' AND source_id = NEW.id;
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
    NEW.location_label,
    NEW.name,
    NEW.description,
    NEW.start_at,
    COALESCE(NEW.end_at, NEW.start_at + INTERVAL '1 hour'),
    'internal_event',
    NEW.id,
    NEW.status,
    jsonb_build_object(
      'department_id', NEW.department_id,
      'event_type_id', NEW.event_type_id
    )
  )
  ON CONFLICT (organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL
  DO UPDATE SET
    venue_id = EXCLUDED.venue_id,
    space_label = EXCLUDED.space_label,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Refresh synced rows for existing internal events
UPDATE public.resource_reservations rr
SET
  venue_id = ie.venue_id,
  space_label = ie.location_label,
  updated_at = NOW()
FROM public.internal_events ie
WHERE rr.source_type = 'internal_event'
  AND rr.source_id = ie.id;
