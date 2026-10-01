-- Places and companies quoted for dinners (venues, kids venues, transportation).
-- Quotes live on an event so a later dinner can start from an earlier year.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.event_planning_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('dinner_venue', 'kids_venue', 'transport')),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  waiver_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_planning_places_org_kind_idx
  ON public.event_planning_places (organization_id, kind, name);

CREATE TABLE IF NOT EXISTS public.event_planning_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  internal_event_id UUID NOT NULL REFERENCES public.internal_events(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.event_planning_places(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'considering' CHECK (status IN ('considering', 'chosen', 'passed')),
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  included_notes TEXT,
  reference_price_cents INTEGER CHECK (reference_price_cents IS NULL OR reference_price_cents >= 0),
  source_event_id UUID REFERENCES public.internal_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (internal_event_id, place_id)
);

CREATE INDEX IF NOT EXISTS event_planning_quotes_event_idx
  ON public.event_planning_quotes (organization_id, internal_event_id);

CREATE TABLE IF NOT EXISTS public.event_planning_sheets (
  internal_event_id UUID PRIMARY KEY REFERENCES public.internal_events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  expected_headcount INTEGER CHECK (expected_headcount IS NULL OR expected_headcount >= 0),
  other_cost_cents INTEGER CHECK (other_cost_cents IS NULL OR other_cost_cents >= 0),
  worksheet_notes TEXT,
  whatsapp_group_url TEXT,
  kids_message TEXT,
  kids_ticket_type_ids UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_planning_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_planning_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_planning_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage event planning places" ON public.event_planning_places;
CREATE POLICY "Org members manage event planning places"
  ON public.event_planning_places FOR ALL
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

DROP POLICY IF EXISTS "Org members manage event planning quotes" ON public.event_planning_quotes;
CREATE POLICY "Org members manage event planning quotes"
  ON public.event_planning_quotes FOR ALL
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

DROP POLICY IF EXISTS "Org members manage event planning sheets" ON public.event_planning_sheets;
CREATE POLICY "Org members manage event planning sheets"
  ON public.event_planning_sheets FOR ALL
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

COMMENT ON TABLE public.event_planning_places IS
  'Reusable dinner venues, kids-program venues, and transportation companies.';
COMMENT ON TABLE public.event_planning_quotes IS
  'Quotes for one event. Copying a prior event starts the next year from these rows.';
COMMENT ON COLUMN public.event_planning_places.waiver_url IS
  'External waiver form for a kids-program venue, shared with families who buy that ticket.';
