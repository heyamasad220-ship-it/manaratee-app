-- Internal event approval workflow foundation
-- Run after 052_customer_rental_visibility.sql
-- Safe to re-run

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_config JSONB;

ALTER TABLE public.internal_events
  DROP CONSTRAINT IF EXISTS internal_events_status_check;

ALTER TABLE public.internal_events
  ADD CONSTRAINT internal_events_status_check
  CHECK (
    status IN (
      'draft',
      'submitted',
      'awaiting_approval',
      'approved',
      'confirmed',
      'scheduled',
      'declined',
      'cancelled',
      'completed'
    )
  );

-- Map internal event status → resource_reservations calendar status
CREATE OR REPLACE FUNCTION public.sync_internal_event_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'internal_event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.start_at IS NULL OR NEW.status IN ('cancelled', 'declined', 'draft') THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'internal_event' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

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
    NEW.start_at,
    COALESCE(NEW.end_at, NEW.start_at + INTERVAL '1 hour'),
    'internal_event',
    NEW.id,
    v_reservation_status,
    jsonb_build_object(
      'department_id', NEW.department_id,
      'event_type_id', NEW.event_type_id,
      'internal_event_status', NEW.status
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

-- Refresh synced reservation statuses for in-flight requests
UPDATE public.resource_reservations rr
SET
  status = CASE
    WHEN ie.status IN ('submitted', 'awaiting_approval') THEN 'temporary_hold'
    WHEN ie.status IN ('approved', 'confirmed', 'scheduled', 'completed') THEN 'confirmed'
    ELSE rr.status
  END,
  metadata = COALESCE(rr.metadata, '{}'::jsonb) || jsonb_build_object('internal_event_status', ie.status),
  updated_at = NOW()
FROM public.internal_events ie
WHERE rr.source_type = 'internal_event'
  AND rr.source_id = ie.id;
