-- Vendor Hub announcements + notification module key
-- Run in Supabase SQL Editor after 082_vendor_participation_evaluations.sql

ALTER TABLE public.module_notification_settings
  DROP CONSTRAINT IF EXISTS module_notification_settings_module_key_check;

ALTER TABLE public.module_notification_settings
  ADD CONSTRAINT module_notification_settings_module_key_check
  CHECK (module_key IN ('event_management', 'venue_rentals', 'vendor_hub'));

CREATE TABLE IF NOT EXISTS public.vendor_hub_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_hub_event_id UUID NOT NULL REFERENCES public.vendor_hub_events(id) ON DELETE CASCADE,
  announcement_type TEXT NOT NULL DEFAULT 'general'
    CHECK (announcement_type IN ('published', 'update', 'reminder', 'cancellation', 'general')),
  audience TEXT NOT NULL DEFAULT 'all_approved_vendors'
    CHECK (audience IN ('all_approved_vendors', 'event_participants')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_hub_announcements_event_idx
  ON public.vendor_hub_announcements(vendor_hub_event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vendor_hub_announcements_org_idx
  ON public.vendor_hub_announcements(organization_id);

CREATE TABLE IF NOT EXISTS public.vendor_hub_announcement_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.vendor_hub_announcements(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  email TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued', 'sent', 'failed', 'skipped')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, contact_id)
);

CREATE INDEX IF NOT EXISTS vendor_hub_announcement_recipients_contact_idx
  ON public.vendor_hub_announcement_recipients(contact_id);

ALTER TABLE public.vendor_hub_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_hub_announcement_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage vendor hub announcements"
  ON public.vendor_hub_announcements;
CREATE POLICY "Org members manage vendor hub announcements"
  ON public.vendor_hub_announcements FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage vendor announcement recipients"
  ON public.vendor_hub_announcement_recipients;
CREATE POLICY "Org members manage vendor announcement recipients"
  ON public.vendor_hub_announcement_recipients FOR ALL
  USING (
    announcement_id IN (
      SELECT id FROM public.vendor_hub_announcements a
      WHERE a.organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    announcement_id IN (
      SELECT id FROM public.vendor_hub_announcements a
      WHERE a.organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Vendors can view own announcement recipients"
  ON public.vendor_hub_announcement_recipients;
CREATE POLICY "Vendors can view own announcement recipients"
  ON public.vendor_hub_announcement_recipients FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can update own announcement read status"
  ON public.vendor_hub_announcement_recipients;
CREATE POLICY "Vendors can update own announcement read status"
  ON public.vendor_hub_announcement_recipients FOR UPDATE
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can view announcements sent to them"
  ON public.vendor_hub_announcements;
CREATE POLICY "Vendors can view announcements sent to them"
  ON public.vendor_hub_announcements FOR SELECT
  USING (
    id IN (
      SELECT announcement_id FROM public.vendor_hub_announcement_recipients r
      WHERE r.contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
    )
  );

COMMENT ON TABLE public.vendor_hub_announcements IS
  'Organizer messages to vendors about a bazaar (updates, reminders, cancellations).';
