-- Add Mocktail / smoothie (truck or cart) default booth type at $175.
-- Move the Fall Bazaar mocktail vendor off Ice cream truck onto this type.

DO $$
DECLARE
  v_org_id uuid := 'e057e00a-e4e3-4adf-9af5-f465db1894be';
  v_event_id uuid := '1342449e-38ca-4882-9fb4-1ae4e6120472';
  v_type_name text := 'Mocktail / smoothie (truck or cart)';
  v_default_id uuid;
  v_event_type_id uuid;
  v_new_booth_id uuid;
  v_ice_booth_id uuid;
  v_assignment_id uuid;
  v_vendor_name text;
  v_total int;
BEGIN
  UPDATE public.vendor_hub_booth_types
  SET sort_order = CASE name
    WHEN 'Stage table' THEN 0
    WHEN 'Corner table' THEN 1
    WHEN 'Regular table' THEN 2
    WHEN 'Open table (no clothing)' THEN 3
    WHEN 'Lobby table' THEN 4
    WHEN 'Coffee (lobby or truck)' THEN 5
    WHEN 'Ice cream truck' THEN 6
    WHEN 'Mocktail / smoothie (truck or cart)' THEN 7
    WHEN 'Hot food truck' THEN 8
    WHEN 'Hot meal (Outdoor)' THEN 9
    WHEN 'Hot meal (between buildings)' THEN 9
    WHEN 'Henna' THEN 10
    WHEN 'Face painting' THEN 11
    WHEN 'General merchandise (Outdoor)' THEN 12
    WHEN 'General merchandise (between buildings)' THEN 12
    ELSE sort_order
  END
  WHERE organization_id = v_org_id
    AND (event_id IS NULL OR event_id = v_event_id);

  INSERT INTO public.vendor_hub_booth_types (
    organization_id, event_id, name, price, selection_fee, color, capacity, location,
    description, is_active, sort_order, default_booth_numbers
  )
  SELECT
    v_org_id,
    NULL,
    v_type_name,
    175,
    0,
    '#14b8a6',
    1,
    'Outside truck or cart',
    'One mocktail or smoothie slot — food truck or cart, not both. $175.',
    true,
    7,
    '["MOCK-1"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.vendor_hub_booth_types existing
    WHERE existing.organization_id = v_org_id
      AND existing.event_id IS NULL
      AND existing.name = v_type_name
  );

  SELECT id INTO v_default_id
  FROM public.vendor_hub_booth_types
  WHERE organization_id = v_org_id
    AND event_id IS NULL
    AND name = v_type_name;

  INSERT INTO public.vendor_hub_booth_type_attributes (booth_type_id, attribute_id)
  SELECT v_default_id, a.id
  FROM public.vendor_hub_booth_attributes a
  WHERE a.organization_id = v_org_id
    AND a.slug IN ('outdoor')
  ON CONFLICT (booth_type_id, attribute_id) DO NOTHING;

  INSERT INTO public.vendor_hub_booth_types (
    organization_id, event_id, name, price, selection_fee, color, capacity, location,
    description, is_active, sort_order, default_booth_numbers
  )
  SELECT
    v_org_id,
    v_event_id,
    v_type_name,
    175,
    0,
    '#14b8a6',
    1,
    'Outside truck or cart',
    'One mocktail or smoothie slot — food truck or cart, not both. $175.',
    true,
    7,
    '["MOCK-1"]'::jsonb
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.vendor_hub_booth_types existing
    WHERE existing.event_id = v_event_id
      AND existing.name = v_type_name
  );

  SELECT id INTO v_event_type_id
  FROM public.vendor_hub_booth_types
  WHERE event_id = v_event_id
    AND name = v_type_name;

  INSERT INTO public.vendor_hub_booth_type_attributes (booth_type_id, attribute_id)
  SELECT v_event_type_id, a.id
  FROM public.vendor_hub_booth_attributes a
  WHERE a.organization_id = v_org_id
    AND a.slug IN ('outdoor')
  ON CONFLICT (booth_type_id, attribute_id) DO NOTHING;

  INSERT INTO public.vendor_hub_booths (
    event_id, booth_type_id, number, location, status, vendor_name, notes
  )
  SELECT
    v_event_id,
    v_event_type_id,
    'MOCK-1',
    'Outside truck or cart',
    'available',
    NULL,
    NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.vendor_hub_booths existing
    WHERE existing.event_id = v_event_id
      AND existing.number = 'MOCK-1'
  );

  SELECT id INTO v_new_booth_id
  FROM public.vendor_hub_booths
  WHERE event_id = v_event_id
    AND number = 'MOCK-1';

  SELECT b.id, a.id, b.vendor_name
  INTO v_ice_booth_id, v_assignment_id, v_vendor_name
  FROM public.vendor_hub_booths b
  JOIN public.vendor_hub_booth_assignments a ON a.booth_id = b.id
  WHERE b.event_id = v_event_id
    AND b.number = 'ICE-1'
    AND b.status IN ('assigned', 'reserved', 'confirmed', 'occupied');

  IF v_assignment_id IS NOT NULL AND v_new_booth_id IS NOT NULL THEN
    UPDATE public.vendor_hub_booths
    SET
      status = 'assigned',
      vendor_name = v_vendor_name
    WHERE id = v_new_booth_id;

    UPDATE public.vendor_hub_booth_assignments
    SET booth_id = v_new_booth_id
    WHERE id = v_assignment_id;

    UPDATE public.vendor_hub_booths
    SET
      status = 'available',
      vendor_name = NULL
    WHERE id = v_ice_booth_id;
  END IF;

  DELETE FROM public.vendor_hub_booth_setup_template_lines l
  USING public.vendor_hub_booth_setup_templates t
  WHERE l.template_id = t.id
    AND t.organization_id = v_org_id
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
  WHERE t.organization_id = v_org_id
    AND t.slug IN ('default-bazaar-layout', 'mas-dallas-fall-bazaar-layout');

  SELECT count(*) INTO v_total
  FROM public.vendor_hub_booths
  WHERE event_id = v_event_id;

  UPDATE public.vendor_hub_events
  SET total_booths = v_total
  WHERE id = v_event_id;
END $$;
