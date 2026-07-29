-- Shared scheduling foundation hardening:
-- 1) Program schedule items can link to a venue (shared calendar / conflicts)
-- 2) Setup + cleanup minutes expand occupied windows on resource_reservations
-- Run after 208_facility_inventory_phase1_fields.sql

-- ---------------------------------------------------------------------------
-- Programs → optional venue FK
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_schedule_items
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS program_schedule_items_org_venue_idx
  ON public.program_schedule_items(organization_id, venue_id);

COMMENT ON COLUMN public.program_schedule_items.venue_id IS
  'Optional bookable venue for facility conflict checks and calendar placement. location remains a display label.';

-- ---------------------------------------------------------------------------
-- Setup / cleanup buffers (occupied period = start - setup … end + cleanup)
-- ---------------------------------------------------------------------------
ALTER TABLE public.rental_reservations
  ADD COLUMN IF NOT EXISTS setup_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (setup_minutes >= 0 AND setup_minutes <= 24 * 60),
  ADD COLUMN IF NOT EXISTS cleanup_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (cleanup_minutes >= 0 AND cleanup_minutes <= 24 * 60);

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS setup_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (setup_minutes >= 0 AND setup_minutes <= 24 * 60),
  ADD COLUMN IF NOT EXISTS cleanup_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (cleanup_minutes >= 0 AND cleanup_minutes <= 24 * 60);

-- ---------------------------------------------------------------------------
-- Rental → resource_reservations sync (occupied window)
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

  IF NEW.status IN ('cancelled', 'expired') THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'venue_rental' AND source_id = NEW.id;
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
  )
  ON CONFLICT (organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL
  DO UPDATE SET
    venue_id = EXCLUDED.venue_id,
    title = EXCLUDED.title,
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

-- ---------------------------------------------------------------------------
-- Internal event → resource_reservations sync (occupied window)
-- ---------------------------------------------------------------------------
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
      'event_start_at', NEW.start_at,
      'event_end_at', v_event_end,
      'setup_minutes', v_setup,
      'cleanup_minutes', v_cleanup
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

-- Re-sync existing rows so occupied windows / titles refresh
UPDATE public.rental_reservations
SET updated_at = NOW()
WHERE status NOT IN ('cancelled', 'expired');

UPDATE public.internal_events
SET updated_at = NOW()
WHERE start_at IS NOT NULL
  AND status IS DISTINCT FROM 'cancelled';

NOTIFY pgrst, 'reload schema';
