-- Shared resource reservation layer for all facility calendars
-- Run after 037_internal_events_foundation.sql

CREATE TABLE IF NOT EXISTS public.resource_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  space_label TEXT,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'venue_rental',
      'internal_event',
      'program_facility',
      'maintenance_block',
      'space_closure'
    )
  ),
  source_id UUID,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS resource_reservations_org_range_idx
  ON public.resource_reservations(organization_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS resource_reservations_org_source_idx
  ON public.resource_reservations(organization_id, source_type);

CREATE UNIQUE INDEX IF NOT EXISTS resource_reservations_synced_source_idx
  ON public.resource_reservations(organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.resource_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage resource reservations"
  ON public.resource_reservations;
CREATE POLICY "Org members manage resource reservations"
  ON public.resource_reservations FOR ALL
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

DROP TRIGGER IF EXISTS resource_reservations_updated_at ON public.resource_reservations;
CREATE TRIGGER resource_reservations_updated_at
  BEFORE UPDATE ON public.resource_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Sync internal_events → resource_reservations
-- ---------------------------------------------------------------------------
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
    NULL,
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

DROP TRIGGER IF EXISTS internal_events_reservation_sync ON public.internal_events;
CREATE TRIGGER internal_events_reservation_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.internal_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_internal_event_reservation();

-- ---------------------------------------------------------------------------
-- Sync venue_bookings → resource_reservations
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.venue_booking_bounds(DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.venue_booking_bounds(
  DATE,
  TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE
);

CREATE OR REPLACE FUNCTION public.venue_booking_bounds(
  p_event_date DATE,
  p_start_time TIME WITHOUT TIME ZONE,
  p_end_time TIME WITHOUT TIME ZONE
)
RETURNS TABLE(start_at TIMESTAMPTZ, end_at TIMESTAMPTZ)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_start TIMESTAMP;
  v_end TIMESTAMP;
BEGIN
  IF p_event_date IS NULL THEN
    RETURN;
  END IF;

  v_start := p_event_date + COALESCE(p_start_time, TIME '09:00');
  v_end := p_event_date + COALESCE(p_end_time, TIME '10:00');

  IF v_end <= v_start THEN
    v_end := v_start + INTERVAL '1 hour';
  END IF;

  start_at := v_start AT TIME ZONE 'UTC';
  end_at := v_end AT TIME ZONE 'UTC';
  RETURN NEXT;
END;
$$;

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

  IF NEW.status IN ('cancelled', 'rejected') OR NEW.event_date IS NULL THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'venue_rental' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT * INTO v_bounds
  FROM public.venue_booking_bounds(NEW.event_date, NEW.start_time, NEW.end_time);

  IF v_bounds.start_at IS NULL THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'venue_rental' AND source_id = NEW.id;
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
      'guest_count', NEW.guest_count,
      'user_id', NEW.user_id
    )
  )
  ON CONFLICT (organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL
  DO UPDATE SET
    venue_id = EXCLUDED.venue_id,
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'venue_bookings'
  ) THEN
    DROP TRIGGER IF EXISTS venue_bookings_reservation_sync ON public.venue_bookings;
    CREATE TRIGGER venue_bookings_reservation_sync
      AFTER INSERT OR UPDATE OR DELETE ON public.venue_bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_venue_booking_reservation();
  END IF;
END $$;

-- Backfill internal events
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
SELECT
  ie.organization_id,
  NULL,
  ie.location_label,
  ie.name,
  ie.description,
  ie.start_at,
  COALESCE(ie.end_at, ie.start_at + INTERVAL '1 hour'),
  'internal_event',
  ie.id,
  ie.status,
  jsonb_build_object(
    'department_id', ie.department_id,
    'event_type_id', ie.event_type_id
  )
FROM public.internal_events ie
WHERE ie.start_at IS NOT NULL
  AND ie.status <> 'cancelled'
ON CONFLICT (organization_id, source_type, source_id)
WHERE source_id IS NOT NULL
DO NOTHING;

-- Backfill venue bookings when table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'venue_bookings'
  ) THEN
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
    SELECT
      vb.organization_id,
      vb.venue_id,
      NULL,
      COALESCE(NULLIF(vb.event_type, ''), 'Venue Rental'),
      vb.notes,
      bounds.start_at,
      bounds.end_at,
      'venue_rental',
      vb.id,
      vb.status,
      jsonb_build_object(
        'guest_count', vb.guest_count,
        'user_id', vb.user_id
      )
    FROM public.venue_bookings vb
    CROSS JOIN LATERAL public.venue_booking_bounds(
      vb.event_date,
      vb.start_time,
      vb.end_time
    ) AS bounds
    WHERE vb.event_date IS NOT NULL
      AND vb.status NOT IN ('cancelled', 'rejected')
      AND bounds.start_at IS NOT NULL
    ON CONFLICT (organization_id, source_type, source_id)
    WHERE source_id IS NOT NULL
    DO NOTHING;
  END IF;
END $$;
