-- Internal events foundation: event_types + internal_events
-- Run in Supabase SQL Editor after 036_revert_signups_childcare_modules.sql

CREATE TABLE IF NOT EXISTS public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS event_types_org_active_idx
  ON public.event_types(organization_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.internal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'completed', 'cancelled')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  location_label TEXT,
  timezone TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS internal_events_org_status_idx
  ON public.internal_events(organization_id, status);

CREATE INDEX IF NOT EXISTS internal_events_org_department_idx
  ON public.internal_events(organization_id, department_id);

CREATE INDEX IF NOT EXISTS internal_events_org_start_idx
  ON public.internal_events(organization_id, start_at);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage event types" ON public.event_types;
CREATE POLICY "Org members manage event types"
  ON public.event_types FOR ALL
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

DROP POLICY IF EXISTS "Org members manage internal events" ON public.internal_events;
CREATE POLICY "Org members manage internal events"
  ON public.internal_events FOR ALL
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

DROP TRIGGER IF EXISTS event_types_updated_at ON public.event_types;
CREATE TRIGGER event_types_updated_at
  BEFORE UPDATE ON public.event_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS internal_events_updated_at ON public.internal_events;
CREATE TRIGGER internal_events_updated_at
  BEFORE UPDATE ON public.internal_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Seed default event types for every organization
INSERT INTO public.event_types (organization_id, name, slug, sort_order)
SELECT o.id, v.name, v.slug, v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Workshop', 'workshop', 10),
    ('Fundraiser', 'fundraiser', 20),
    ('Community Event', 'community', 30),
    ('Religious Program', 'religious', 40),
    ('Meeting', 'meeting', 50),
    ('Other', 'other', 99)
) AS v(name, slug, sort_order)
ON CONFLICT (organization_id, slug) DO NOTHING;
