-- Community Calendar visibility for Event Management public/community listings.
-- Shared Community Calendar also includes Vendor Hub bazaar events (calendar_status).

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS community_calendar_status text NOT NULL DEFAULT 'not_published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'internal_events_community_calendar_status_check'
  ) THEN
    ALTER TABLE public.internal_events
      ADD CONSTRAINT internal_events_community_calendar_status_check
      CHECK (
        community_calendar_status IN (
          'not_published',
          'community_visible',
          'published'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.internal_events.community_calendar_status IS
  'Community Calendar visibility: not_published (private), community_visible, published (public).';
