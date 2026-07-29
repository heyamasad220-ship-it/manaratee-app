-- Facility inventory catalog (equipment / shared resources)
-- Run in Supabase SQL Editor after 206_venue_rental_status_process.sql

CREATE TABLE IF NOT EXISTS public.facility_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  location TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS facility_inventory_items_org_active_idx
  ON public.facility_inventory_items(organization_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS facility_inventory_items_org_name_idx
  ON public.facility_inventory_items(organization_id, name);

ALTER TABLE public.facility_inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage facility inventory" ON public.facility_inventory_items;
CREATE POLICY "Org members manage facility inventory"
  ON public.facility_inventory_items FOR ALL
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

DROP TRIGGER IF EXISTS facility_inventory_items_updated_at ON public.facility_inventory_items;
CREATE TRIGGER facility_inventory_items_updated_at
  BEFORE UPDATE ON public.facility_inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
