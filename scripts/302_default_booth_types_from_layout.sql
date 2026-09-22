-- Org default booth types for MAS Dallas (table selection fees + numbered tables).
-- Rebuilds the default bazaar template from those types.
-- Run after scripts/301_vendor_booth_table_selection.sql.

ALTER TABLE public.vendor_hub_booth_types
  ADD COLUMN IF NOT EXISTS default_booth_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendor_hub_booth_types.default_booth_numbers IS
  'Suggested table numbers when this org default type is copied into a template (e.g. ["T1","T2"]).';

INSERT INTO public.vendor_hub_booth_types (
  organization_id, event_id, name, price, selection_fee, color, capacity, location,
  description, is_active, sort_order, default_booth_numbers
)
SELECT
  'e057e00a-e4e3-4adf-9af5-f465db1894be',
  NULL,
  v.name,
  v.price,
  v.selection_fee,
  v.color,
  v.capacity,
  v.location,
  v.description,
  true,
  v.sort_order,
  v.booth_numbers::jsonb
FROM (
  VALUES
    ('Stage table'::text, 150::numeric, 10::numeric, '#f97316'::text, 3, 'Main Prayer Hall (stage)'::text,
     'Orange T1–T3 on the stage. +$10 to pick this table.'::text, 0, '["T1","T2","T3"]'::text),
    ('Corner table', 150, 25, '#ec4899', 2, 'Main Prayer Hall',
     'Pink T15 and T25. +$25 to pick a corner table.', 1, '["T15","T25"]'),
    ('Regular table', 150, 10, '#22c55e', 12, 'Main Prayer Hall',
     'Green regular hall tables. +$10 to pick this table.', 2,
     '["T14","T16","T17","T18","T19","T20","T21","T22","T23","T24","T26","T27"]'),
    ('Open table (no clothing)', 150, 10, '#38bdf8', 10, 'Main Prayer Hall',
     'Blue T4–T13. Books, toys, and goods that do not need clothing racks. +$10 to pick this table.', 3,
     '["T4","T5","T6","T7","T8","T9","T10","T11","T12","T13"]'),
    ('Lobby table', 300, 0, '#d97706', 6, 'Main Lobby',
     'Maximum exposure. $300 includes picking a lobby table.', 4,
     '["L1","L2","L3","L4","L5","L6"]'),
    ('Coffee (lobby or truck)', 300, 0, '#92400e', 1, 'Lobby or outside truck',
     'One coffee slot — cart in the lobby or a coffee truck, not both.', 5, '["COFF-1"]'),
    ('Ice cream truck', 125, 0, '#06b6d4', 1, 'Outside',
     'One ice cream truck of up to four outdoor trucks.', 6, '["ICE-1"]'),
    ('Hot food truck', 275, 0, '#dc2626', 3, 'Outside',
     'Hot-food trucks (use three when coffee is in the lobby so total trucks stay at four).', 7,
     '["TRK-1","TRK-2","TRK-3"]'),
    ('Hot meal (between buildings)', 275, 0, '#b91c1c', 6, 'Between the two buildings',
     'Six hot-meal spots between the buildings.', 8,
     '["HM-1","HM-2","HM-3","HM-4","HM-5","HM-6"]'),
    ('Henna', 100, 0, '#a855f7', 1, 'Between the two buildings', 'One henna table.', 9, '["HN-1"]'),
    ('Face painting', 100, 0, '#f472b6', 1, 'Between the two buildings', 'One face-painting table.', 10, '["FP-1"]'),
    ('General merchandise (between buildings)', 100, 10, '#65a30d', 4, 'Between the two buildings',
     'Four general merchandise tables. +$10 to pick a specific table.', 11,
     '["GM-1","GM-2","GM-3","GM-4"]')
) AS v(name, price, selection_fee, color, capacity, location, description, sort_order, booth_numbers)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendor_hub_booth_types existing
  WHERE existing.organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
    AND existing.event_id IS NULL
    AND existing.name = v.name
);

INSERT INTO public.vendor_hub_booth_type_attributes (booth_type_id, attribute_id)
SELECT bt.id, a.id
FROM public.vendor_hub_booth_types bt
JOIN public.vendor_hub_booth_attributes a
  ON a.organization_id = bt.organization_id
JOIN (
  VALUES
    ('Stage table', 'near-stage'),
    ('Stage table', 'indoor'),
    ('Corner table', 'corner-booth'),
    ('Corner table', 'indoor'),
    ('Regular table', 'indoor'),
    ('Open table (no clothing)', 'no-clothing'),
    ('Open table (no clothing)', 'indoor'),
    ('Lobby table', 'near-entrance'),
    ('Lobby table', 'premium-location'),
    ('Lobby table', 'indoor'),
    ('Coffee (lobby or truck)', 'premium-location'),
    ('Ice cream truck', 'outdoor'),
    ('Ice cream truck', 'vehicle-access'),
    ('Hot food truck', 'outdoor'),
    ('Hot food truck', 'vehicle-access'),
    ('Hot meal (between buildings)', 'outdoor'),
    ('Henna', 'outdoor'),
    ('Face painting', 'outdoor'),
    ('General merchandise (between buildings)', 'outdoor')
) AS map(type_name, attr_slug) ON map.type_name = bt.name AND map.attr_slug = a.slug
WHERE bt.organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
  AND bt.event_id IS NULL
ON CONFLICT (booth_type_id, attribute_id) DO NOTHING;

INSERT INTO public.vendor_hub_booth_setup_templates (
  organization_id, name, slug, description, is_active, sort_order
)
SELECT
  'e057e00a-e4e3-4adf-9af5-f465db1894be',
  'Default bazaar layout',
  'default-bazaar-layout',
  'Built from organization default booth types. Vendors pick a numbered table.',
  true,
  0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendor_hub_booth_setup_templates
  WHERE organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
    AND slug IN ('default-bazaar-layout', 'mas-dallas-fall-bazaar-layout')
);

DELETE FROM public.vendor_hub_booth_setup_template_lines l
USING public.vendor_hub_booth_setup_templates t
WHERE l.template_id = t.id
  AND t.organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
  AND t.slug IN ('default-bazaar-layout', 'mas-dallas-fall-bazaar-layout');

INSERT INTO public.vendor_hub_booth_setup_template_lines (
  template_id, line_name, price, selection_fee, color, quantity, capacity,
  location, description, sort_order, attribute_slugs, booth_numbers
)
SELECT
  t.id,
  bt.name,
  COALESCE(bt.price, 0),
  COALESCE(bt.selection_fee, 0),
  COALESCE(bt.color, '#2563eb'),
  GREATEST(COALESCE(bt.capacity, 1), 1),
  COALESCE(bt.capacity, 0),
  bt.location,
  bt.description,
  COALESCE(bt.sort_order, 0),
  COALESCE((
    SELECT jsonb_agg(a.slug ORDER BY a.sort_order)
    FROM public.vendor_hub_booth_type_attributes link
    JOIN public.vendor_hub_booth_attributes a ON a.id = link.attribute_id
    WHERE link.booth_type_id = bt.id
  ), '[]'::jsonb),
  COALESCE(bt.default_booth_numbers, '[]'::jsonb)
FROM public.vendor_hub_booth_setup_templates t
JOIN public.vendor_hub_booth_types bt
  ON bt.organization_id = t.organization_id
 AND bt.event_id IS NULL
WHERE t.organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
  AND t.slug IN ('default-bazaar-layout', 'mas-dallas-fall-bazaar-layout');

UPDATE public.vendor_hub_booth_setup_templates
SET
  name = 'Default bazaar layout',
  description = 'Built from organization default booth types. Vendors pick a numbered table: hall regular/blue/stage +$10, corners +$25.',
  is_active = true,
  sort_order = 0
WHERE organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
  AND slug IN ('default-bazaar-layout', 'mas-dallas-fall-bazaar-layout');

NOTIFY pgrst, 'reload schema';
