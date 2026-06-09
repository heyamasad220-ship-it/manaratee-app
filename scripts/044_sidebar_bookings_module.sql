-- Rename Spaces module to Bookings and move under Operations (remove Facilities group)
-- Sets Operations sidebar order: Event Management, Venue Rentals, Programs, Bookings
-- Safe to re-run

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.modules
  SET group_name = 'Operations', sort_order = 40
  WHERE slug = 'event-management';

  UPDATE public.modules
  SET name = 'Venue Rentals', group_name = 'Operations', sort_order = 41
  WHERE slug = 'bookings';

  UPDATE public.modules
  SET group_name = 'Operations', sort_order = 42
  WHERE slug = 'programs';

  UPDATE public.modules
  SET name = 'Bookings', group_name = 'Operations', sort_order = 43, route = '/facilities/calendar'
  WHERE slug = 'spaces';
END $$;
