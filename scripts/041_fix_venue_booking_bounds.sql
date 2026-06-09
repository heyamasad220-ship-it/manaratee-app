-- Fix venue_booking_bounds signature when 040 was partially applied.
-- Prerequisite: scripts/040_resource_reservations.sql must have completed
-- (resource_reservations table must exist). If it does not, run 040 first — not this file.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'resource_reservations'
  ) THEN
    RAISE EXCEPTION
      'public.resource_reservations does not exist. Run scripts/040_resource_reservations.sql first.';
  END IF;
END $$;

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

-- Backfill venue bookings
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
