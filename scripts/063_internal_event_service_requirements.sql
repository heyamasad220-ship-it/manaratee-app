-- Event service requirements: volunteers, childcare, vendors
-- Run after 062_childcare_provider_affiliation.sql

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS requires_volunteers BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_childcare BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_vendors BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_requirements JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.internal_events.requires_volunteers IS
  'Event needs volunteer sign-ups from the workforce volunteer roster.';

COMMENT ON COLUMN public.internal_events.requires_childcare IS
  'Event needs childcare providers from approved provider applications.';

COMMENT ON COLUMN public.internal_events.requires_vendors IS
  'Event allows vendor participation (events only, not programs).';

COMMENT ON COLUMN public.internal_events.service_requirements IS
  'Optional detail config for enabled service modules (capacity, deadlines, roles, etc.).';
