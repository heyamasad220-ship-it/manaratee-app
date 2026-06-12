-- Booth attributes / features catalog (org-scoped, reusable)
-- Run in Supabase SQL Editor after 076_vendor_hub_contact_centric.sql

CREATE TABLE IF NOT EXISTS public.vendor_hub_booth_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'utility'
    CHECK (category IN ('utility', 'placement', 'environment')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS vendor_hub_booth_attributes_org_active_idx
  ON public.vendor_hub_booth_attributes(organization_id, is_active, sort_order);

ALTER TABLE public.vendor_hub_booth_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage vendor hub booth attributes" ON public.vendor_hub_booth_attributes;
CREATE POLICY "Org members manage vendor hub booth attributes"
  ON public.vendor_hub_booth_attributes FOR ALL
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

DROP TRIGGER IF EXISTS vendor_hub_booth_attributes_updated_at ON public.vendor_hub_booth_attributes;
CREATE TRIGGER vendor_hub_booth_attributes_updated_at
  BEFORE UPDATE ON public.vendor_hub_booth_attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Default attributes on booth types (event-scoped types, org-scoped attributes)
CREATE TABLE IF NOT EXISTS public.vendor_hub_booth_type_attributes (
  booth_type_id UUID NOT NULL REFERENCES public.vendor_hub_booth_types(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES public.vendor_hub_booth_attributes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booth_type_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS vendor_hub_booth_type_attributes_type_idx
  ON public.vendor_hub_booth_type_attributes(booth_type_id);

ALTER TABLE public.vendor_hub_booth_type_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage booth type attributes" ON public.vendor_hub_booth_type_attributes;
CREATE POLICY "Org members manage booth type attributes"
  ON public.vendor_hub_booth_type_attributes FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_hub_booth_types bt
      LEFT JOIN public.vendor_hub_events e ON e.id = bt.event_id
      WHERE bt.id = booth_type_id
        AND (
          e.organization_id IS NULL
          OR e.organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendor_hub_booth_types bt
      LEFT JOIN public.vendor_hub_events e ON e.id = bt.event_id
      WHERE bt.id = booth_type_id
        AND (
          e.organization_id IS NULL
          OR e.organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
          )
        )
    )
    AND attribute_id IN (
      SELECT id FROM public.vendor_hub_booth_attributes
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Per-booth attribute overrides / additions
CREATE TABLE IF NOT EXISTS public.vendor_hub_booth_attribute_links (
  booth_id UUID NOT NULL REFERENCES public.vendor_hub_booths(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES public.vendor_hub_booth_attributes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booth_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS vendor_hub_booth_attribute_links_booth_idx
  ON public.vendor_hub_booth_attribute_links(booth_id);

ALTER TABLE public.vendor_hub_booth_attribute_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage booth attribute links" ON public.vendor_hub_booth_attribute_links;
CREATE POLICY "Org members manage booth attribute links"
  ON public.vendor_hub_booth_attribute_links FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_hub_booths b
      LEFT JOIN public.vendor_hub_events e ON e.id = b.event_id
      WHERE b.id = booth_id
        AND (
          e.organization_id IS NULL
          OR e.organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendor_hub_booths b
      LEFT JOIN public.vendor_hub_events e ON e.id = b.event_id
      WHERE b.id = booth_id
        AND (
          e.organization_id IS NULL
          OR e.organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
          )
        )
    )
    AND attribute_id IN (
      SELECT id FROM public.vendor_hub_booth_attributes
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

INSERT INTO public.vendor_hub_booth_attributes (organization_id, name, slug, category, sort_order)
SELECT o.id, v.name, v.slug, v.category, v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Electricity', 'electricity', 'utility', 10),
    ('Water', 'water', 'utility', 20),
    ('WiFi', 'wifi', 'utility', 30),
    ('Corner Booth', 'corner-booth', 'placement', 40),
    ('Premium Location', 'premium-location', 'placement', 50),
    ('Near Entrance', 'near-entrance', 'placement', 60),
    ('Near Stage', 'near-stage', 'placement', 70),
    ('Covered', 'covered', 'environment', 80),
    ('Indoor', 'indoor', 'environment', 90),
    ('Outdoor', 'outdoor', 'environment', 100),
    ('Vehicle Access', 'vehicle-access', 'environment', 110)
) AS v(name, slug, category, sort_order)
ON CONFLICT (organization_id, slug) DO NOTHING;

COMMENT ON TABLE public.vendor_hub_booth_attributes IS
  'Reusable booth features (electricity, WiFi, placement) scoped per organization.';

COMMENT ON TABLE public.vendor_hub_booth_type_attributes IS
  'Default attributes for a booth type within an event.';

COMMENT ON TABLE public.vendor_hub_booth_attribute_links IS
  'Additional or override attributes on an individual booth.';
