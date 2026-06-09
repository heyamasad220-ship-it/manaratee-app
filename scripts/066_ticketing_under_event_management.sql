-- Ticketing navigation is now nested under Event Management in the app sidebar.
-- The ticketing module row remains for org licensing; it is hidden from the sidebar in code.
-- Run in Supabase SQL Editor after 065_event_ticketing.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.modules
  SET
    group_name = 'Operations',
    description = 'Event ticketing and sales (access via Event Management)'
  WHERE slug = 'ticketing';
END $$;
