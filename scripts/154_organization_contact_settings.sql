-- Contact profile timeline reset timestamp (per org).
-- Run once in Supabase SQL editor before clear-contact-timelines.mjs --execute

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS contact_timeline_reset_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.contact_timeline_reset_at IS
  'Contact profile Timeline hides events before this time (plus import-sourced gifts). Set by scripts/clear-contact-timelines.mjs.';
