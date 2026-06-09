-- Childcare events and registrations for /child-care/registrations
-- Run in Supabase SQL Editor after 034_operations_signups_childcare.sql

CREATE TABLE IF NOT EXISTS public.childcare_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  capacity INTEGER NOT NULL DEFAULT 20 CHECK (capacity > 0),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS childcare_events_org_date_idx
  ON public.childcare_events(organization_id, event_date);

CREATE TABLE IF NOT EXISTS public.childcare_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  childcare_event_id UUID NOT NULL REFERENCES public.childcare_events(id) ON DELETE CASCADE,
  child_name TEXT NOT NULL,
  child_age INTEGER CHECK (child_age IS NULL OR child_age >= 0),
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('confirmed', 'pending', 'waitlisted', 'cancelled')),
  allergies TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS childcare_registrations_org_event_idx
  ON public.childcare_registrations(organization_id, childcare_event_id);

CREATE INDEX IF NOT EXISTS childcare_registrations_org_status_idx
  ON public.childcare_registrations(organization_id, status);

ALTER TABLE public.childcare_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.childcare_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage childcare events"
  ON public.childcare_events;
CREATE POLICY "Org members manage childcare events"
  ON public.childcare_events FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage childcare registrations"
  ON public.childcare_registrations;
CREATE POLICY "Org members manage childcare registrations"
  ON public.childcare_registrations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS childcare_events_updated_at ON public.childcare_events;
CREATE TRIGGER childcare_events_updated_at
  BEFORE UPDATE ON public.childcare_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS childcare_registrations_updated_at ON public.childcare_registrations;
CREATE TRIGGER childcare_registrations_updated_at
  BEFORE UPDATE ON public.childcare_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
