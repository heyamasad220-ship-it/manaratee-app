-- Tracks automated vendor bazaar reminders (7 / 3 / 1 days before event_date)
-- Run in Supabase SQL Editor after 083_vendor_hub_announcements.sql

CREATE TABLE IF NOT EXISTS public.vendor_hub_event_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_hub_event_id UUID NOT NULL REFERENCES public.vendor_hub_events(id) ON DELETE CASCADE,
  days_before INTEGER NOT NULL CHECK (days_before IN (1, 3, 7)),
  announcement_id UUID REFERENCES public.vendor_hub_announcements(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_hub_event_id, days_before)
);

CREATE INDEX IF NOT EXISTS vendor_hub_event_reminder_log_event_idx
  ON public.vendor_hub_event_reminder_log(vendor_hub_event_id);

ALTER TABLE public.vendor_hub_event_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view vendor hub reminder log"
  ON public.vendor_hub_event_reminder_log;
CREATE POLICY "Org members view vendor hub reminder log"
  ON public.vendor_hub_event_reminder_log FOR SELECT
  USING (
    vendor_hub_event_id IN (
      SELECT id FROM public.vendor_hub_events e
      WHERE e.organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

COMMENT ON TABLE public.vendor_hub_event_reminder_log IS
  'Prevents duplicate automated vendor reminders for the same bazaar and lead time.';
