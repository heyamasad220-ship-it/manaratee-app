-- Phase 1 inventory fields: category, variants, purchase date, unit cost
-- Run after 207_facility_inventory_items.sql

ALTER TABLE public.facility_inventory_items
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'equipment',
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS style TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS purchased_at DATE,
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2);

ALTER TABLE public.facility_inventory_items
  DROP CONSTRAINT IF EXISTS facility_inventory_items_category_check;

ALTER TABLE public.facility_inventory_items
  ADD CONSTRAINT facility_inventory_items_category_check
  CHECK (
    category IN (
      'furniture',
      'seating',
      'cleaning',
      'paper_goods',
      'equipment',
      'other'
    )
  );

ALTER TABLE public.facility_inventory_items
  DROP CONSTRAINT IF EXISTS facility_inventory_items_unit_cost_check;

ALTER TABLE public.facility_inventory_items
  ADD CONSTRAINT facility_inventory_items_unit_cost_check
  CHECK (unit_cost IS NULL OR unit_cost >= 0);

CREATE INDEX IF NOT EXISTS facility_inventory_items_org_category_idx
  ON public.facility_inventory_items(organization_id, category, sort_order);

NOTIFY pgrst, 'reload schema';
