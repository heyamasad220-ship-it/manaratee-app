-- Venue rental event types (customer-facing booking categories)
-- Run after 042_internal_events_venue_link.sql

CREATE TABLE IF NOT EXISTS public.venue_rental_event_types (
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

CREATE INDEX IF NOT EXISTS venue_rental_event_types_org_active_idx
  ON public.venue_rental_event_types(organization_id, is_active, sort_order);

ALTER TABLE public.venue_rental_event_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage venue rental event types"
  ON public.venue_rental_event_types;
CREATE POLICY "Org members manage venue rental event types"
  ON public.venue_rental_event_types FOR ALL
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

DROP TRIGGER IF EXISTS venue_rental_event_types_updated_at
  ON public.venue_rental_event_types;
CREATE TRIGGER venue_rental_event_types_updated_at
  BEFORE UPDATE ON public.venue_rental_event_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.venue_rental_event_types (organization_id, name, slug, sort_order)
SELECT o.id, v.name, v.slug, v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Wedding', 'wedding', 10),
    ('Birthday Party', 'birthday-party', 20),
    ('Graduation Party', 'graduation-party', 30),
    ('Baby Shower', 'baby-shower', 40),
    ('Engagement', 'engagement', 50),
    ('Corporate Event', 'corporate-event', 60),
    ('Meeting', 'meeting', 70),
    ('Memorial Service', 'memorial-service', 80),
    ('Religious Ceremony', 'religious-ceremony', 90),
    ('Other', 'other', 99)
) AS v(name, slug, sort_order)
ON CONFLICT (organization_id, slug) DO NOTHING;
