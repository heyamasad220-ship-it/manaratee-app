-- Facilities navigation refactor (reverse 044 mislabeling)
-- Run after 048_venue_rental_transition_safety.sql
-- Safe to re-run

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RETURN;
  END IF;

  -- Operations: business modules only
  UPDATE public.modules
  SET group_name = 'Operations', sort_order = 40
  WHERE slug = 'event-management';

  UPDATE public.modules
  SET name = 'Venue Rentals', group_name = 'Operations', sort_order = 41
  WHERE slug = 'bookings';

  UPDATE public.modules
  SET group_name = 'Operations', sort_order = 42
  WHERE slug = 'programs';

  -- Facilities: shared reservation infrastructure (spaces slug)
  UPDATE public.modules
  SET
    name = 'Facilities',
    group_name = 'Facilities',
    sort_order = 50,
    route = '/facilities/reservation-center',
    icon_name = COALESCE(icon_name, 'Building2')
  WHERE slug = 'spaces';
END $$;

COMMENT ON TABLE public.resource_reservations IS
  'Shared reservation engine (infrastructure). Business workflows live in Event Management, Venue Rentals, and Programs; visibility in Facilities.';
