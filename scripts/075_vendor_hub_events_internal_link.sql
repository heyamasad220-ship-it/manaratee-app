-- Link vendor_hub_events to organizations and internal_events (non-destructive)
-- Run in Supabase SQL Editor after 074_vendor_hub_vendor_types.sql

ALTER TABLE public.vendor_hub_events
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS internal_event_id UUID REFERENCES public.internal_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_hub_events_org_idx
  ON public.vendor_hub_events(organization_id);

CREATE INDEX IF NOT EXISTS vendor_hub_events_internal_event_idx
  ON public.vendor_hub_events(internal_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_hub_events_internal_event_unique_idx
  ON public.vendor_hub_events(internal_event_id)
  WHERE internal_event_id IS NOT NULL;

-- Backfill organization_id from linked internal events when possible
UPDATE public.vendor_hub_events vhe
SET organization_id = ie.organization_id
FROM public.internal_events ie
WHERE vhe.internal_event_id = ie.id
  AND vhe.organization_id IS NULL;

ALTER TABLE public.vendor_hub_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage vendor hub events" ON public.vendor_hub_events;
CREATE POLICY "Org members manage vendor hub events"
  ON public.vendor_hub_events FOR ALL
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Event-scoped vendor lifecycle keyed by CRM contact_id (see scripts/076_vendor_hub_contact_centric.sql)
CREATE TABLE IF NOT EXISTS public.vendor_hub_participant_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_hub_event_id UUID NOT NULL REFERENCES public.vendor_hub_events(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'lead'
    CHECK (lifecycle_status IN (
      'lead',
      'applied',
      'under_review',
      'approved',
      'waitlisted',
      'rejected',
      'assigned',
      'payment_pending',
      'paid',
      'checked_in',
      'cancelled'
    )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_hub_participant_status_event_idx
  ON public.vendor_hub_participant_status(vendor_hub_event_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS vendor_hub_participant_status_org_idx
  ON public.vendor_hub_participant_status(organization_id);

ALTER TABLE public.vendor_hub_participant_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage vendor hub participant status" ON public.vendor_hub_participant_status;
CREATE POLICY "Org members manage vendor hub participant status"
  ON public.vendor_hub_participant_status FOR ALL
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

DROP TRIGGER IF EXISTS vendor_hub_participant_status_updated_at ON public.vendor_hub_participant_status;
CREATE TRIGGER vendor_hub_participant_status_updated_at
  BEFORE UPDATE ON public.vendor_hub_participant_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
