-- Vendor Hub vendor types (coffee, dessert, juice, etc.)
-- Run in Supabase SQL Editor after 073_room_setup_styles.sql

CREATE TABLE IF NOT EXISTS public.vendor_hub_vendor_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  default_fee NUMERIC(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS vendor_hub_vendor_types_org_active_idx
  ON public.vendor_hub_vendor_types(organization_id, is_active, sort_order);

ALTER TABLE public.vendor_hub_vendor_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage vendor hub vendor types" ON public.vendor_hub_vendor_types;
CREATE POLICY "Org members manage vendor hub vendor types"
  ON public.vendor_hub_vendor_types FOR ALL
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

DROP TRIGGER IF EXISTS vendor_hub_vendor_types_updated_at ON public.vendor_hub_vendor_types;
CREATE TRIGGER vendor_hub_vendor_types_updated_at
  BEFORE UPDATE ON public.vendor_hub_vendor_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.vendor_hub_vendor_types (organization_id, name, slug, sort_order)
SELECT o.id, v.name, v.slug, v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Coffee', 'coffee', 10),
    ('Dessert', 'dessert', 20),
    ('Juice / Smoothies', 'juice-smoothies', 30),
    ('Food Truck', 'food-truck', 40),
    ('Retail / Merchandise', 'retail-merchandise', 50),
    ('Other', 'other', 99)
) AS v(name, slug, sort_order)
ON CONFLICT (organization_id, slug) DO NOTHING;
