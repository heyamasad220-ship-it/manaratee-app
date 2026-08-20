-- Clarify location_address usage for online meeting links.
-- No schema change — online meeting URLs are stored in internal_events.location_address
-- with location_label = 'Online'.

COMMENT ON COLUMN public.internal_events.location_address IS
  'Street/city address for external venues; meeting URL (http/https) for online events. Null for facility.';
