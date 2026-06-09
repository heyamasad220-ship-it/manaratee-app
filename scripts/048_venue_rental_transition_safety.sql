-- Venue Rentals transition safety
-- Run after 047_venue_rentals_audit_fixes.sql
-- Safe to re-run

COMMENT ON TABLE public.venue_bookings IS
  'LEGACY venue rental bookings. Existing customer/staff pages use this table until Phase B UI cutover. '
  'New customer Venue Rental flow must write venue_rentals + rental_reservations only — never dual-write here.';

-- Tag synced rows so duplicate reports can distinguish legacy vs new flow.
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
      'sync_origin', 'legacy_venue_booking',
      'legacy_venue_booking_id', NEW.id,
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

  IF NEW.status IN ('cancelled', 'expired') THEN
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
  )
  ON CONFLICT (organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL
  DO UPDATE SET
    venue_id = EXCLUDED.venue_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    status = EXCLUDED.status,
    hold_expires_at = EXCLUDED.hold_expires_at,
    created_by = EXCLUDED.created_by,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Backfill sync_origin metadata on existing rows (best-effort classification).
UPDATE public.resource_reservations rr
SET metadata = COALESCE(rr.metadata, '{}'::jsonb) || jsonb_build_object('sync_origin', 'legacy_venue_booking')
WHERE rr.source_type = 'venue_rental'
  AND EXISTS (SELECT 1 FROM public.venue_bookings vb WHERE vb.id = rr.source_id)
  AND COALESCE(rr.metadata->>'sync_origin', '') = '';

UPDATE public.resource_reservations rr
SET metadata = COALESCE(rr.metadata, '{}'::jsonb) || jsonb_build_object('sync_origin', 'venue_rental_reservation')
WHERE rr.source_type = 'venue_rental'
  AND EXISTS (SELECT 1 FROM public.rental_reservations rs WHERE rs.id = rr.source_id)
  AND COALESCE(rr.metadata->>'sync_origin', '') = '';

-- Report overlapping venue_rental blocks with different source_id values for the same tenant + space.
CREATE OR REPLACE FUNCTION public.find_duplicate_venue_rental_blocks(
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  organization_id UUID,
  venue_id UUID,
  reservation_a_id UUID,
  reservation_a_source_id UUID,
  reservation_a_sync_origin TEXT,
  reservation_b_id UUID,
  reservation_b_source_id UUID,
  reservation_b_sync_origin TEXT,
  overlap_start TIMESTAMPTZ,
  overlap_end TIMESTAMPTZ,
  is_legacy_new_pair BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH blocking AS (
    SELECT
      rr.id,
      rr.organization_id,
      rr.venue_id,
      rr.start_at,
      rr.end_at,
      rr.source_id,
      rr.status,
      COALESCE(
        NULLIF(rr.metadata->>'sync_origin', ''),
        CASE
          WHEN EXISTS (SELECT 1 FROM public.rental_reservations rs WHERE rs.id = rr.source_id)
            THEN 'venue_rental_reservation'
          WHEN EXISTS (SELECT 1 FROM public.venue_bookings vb WHERE vb.id = rr.source_id)
            THEN 'legacy_venue_booking'
          ELSE 'unknown'
        END
      ) AS sync_origin
    FROM public.resource_reservations rr
    WHERE rr.source_type = 'venue_rental'
      AND rr.venue_id IS NOT NULL
      AND rr.source_id IS NOT NULL
      AND (p_organization_id IS NULL OR rr.organization_id = p_organization_id)
      AND rr.status NOT IN (
        'cancelled', 'rejected', 'expired', 'declined',
        'hold_expired', 'closed', 'refunded'
      )
  )
  SELECT
    a.organization_id,
    a.venue_id,
    a.id AS reservation_a_id,
    a.source_id AS reservation_a_source_id,
    a.sync_origin AS reservation_a_sync_origin,
    b.id AS reservation_b_id,
    b.source_id AS reservation_b_source_id,
    b.sync_origin AS reservation_b_sync_origin,
    GREATEST(a.start_at, b.start_at) AS overlap_start,
    LEAST(a.end_at, b.end_at) AS overlap_end,
    (
      (a.sync_origin = 'legacy_venue_booking' AND b.sync_origin = 'venue_rental_reservation')
      OR (a.sync_origin = 'venue_rental_reservation' AND b.sync_origin = 'legacy_venue_booking')
    ) AS is_legacy_new_pair
  FROM blocking a
  JOIN blocking b
    ON a.organization_id = b.organization_id
   AND a.venue_id = b.venue_id
   AND a.id < b.id
   AND a.source_id <> b.source_id
   AND a.start_at < b.end_at
   AND a.end_at > b.start_at
  ORDER BY a.organization_id, a.venue_id, overlap_start;
$$;

COMMENT ON FUNCTION public.find_duplicate_venue_rental_blocks(UUID) IS
  'Transition report: overlapping resource_reservations rows (source_type=venue_rental) with different source_id for the same org + venue.';
