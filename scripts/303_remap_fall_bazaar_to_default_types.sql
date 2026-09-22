-- Remap MAS Fall Bazaar (Oct 10 2026) onto organization default booth types.
-- Replaces Eventbrite ticket-type inventory with the Settings layout (50 numbered booths).
-- Regular Eventbrite purchases fill Regular table first, then Open table (no clothing).

DO $$
DECLARE
  v_event_id uuid := '1342449e-38ca-4882-9fb4-1ae4e6120472';
  v_org_id uuid := 'e057e00a-e4e3-4adf-9af5-f465db1894be';
  v_default record;
  v_new_type_id uuid;
  v_number text;
  v_assignment record;
  v_target_name text;
  v_booth_id uuid;
  v_total int;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.vendor_hub_booth_types
    WHERE event_id = v_event_id
      AND name = 'Stage table'
  ) THEN
    RAISE NOTICE 'Fall Bazaar already uses default booth types; skipping.';
    RETURN;
  END IF;

  FOR v_default IN
    SELECT
      id,
      name,
      size,
      price,
      selection_fee,
      color,
      description,
      capacity,
      location,
      is_active,
      sort_order,
      default_booth_numbers
    FROM public.vendor_hub_booth_types
    WHERE organization_id = v_org_id
      AND event_id IS NULL
    ORDER BY sort_order, name
  LOOP
    INSERT INTO public.vendor_hub_booth_types (
      organization_id, event_id, name, size, price, selection_fee, color,
      description, capacity, location, is_active, sort_order, default_booth_numbers
    )
    VALUES (
      v_org_id,
      v_event_id,
      v_default.name,
      v_default.size,
      v_default.price,
      v_default.selection_fee,
      v_default.color,
      v_default.description,
      v_default.capacity,
      v_default.location,
      COALESCE(v_default.is_active, true),
      v_default.sort_order,
      COALESCE(v_default.default_booth_numbers, '[]'::jsonb)
    )
    RETURNING id INTO v_new_type_id;

    INSERT INTO public.vendor_hub_booth_type_attributes (booth_type_id, attribute_id)
    SELECT v_new_type_id, link.attribute_id
    FROM public.vendor_hub_booth_type_attributes link
    WHERE link.booth_type_id = v_default.id
    ON CONFLICT (booth_type_id, attribute_id) DO NOTHING;

    FOR v_number IN
      SELECT jsonb_array_elements_text(COALESCE(v_default.default_booth_numbers, '[]'::jsonb))
    LOOP
      INSERT INTO public.vendor_hub_booths (
        event_id, booth_type_id, number, location, status, vendor_name, notes
      )
      VALUES (
        v_event_id,
        v_new_type_id,
        v_number,
        v_default.location,
        'available',
        NULL,
        NULL
      );
    END LOOP;
  END LOOP;

  FOR v_assignment IN
    SELECT
      a.id,
      a.contact_id,
      a.fee_amount,
      b.vendor_name,
      bt.name AS old_type_name,
      b.number AS old_number
    FROM public.vendor_hub_booth_assignments a
    JOIN public.vendor_hub_booths b ON b.id = a.booth_id
    JOIN public.vendor_hub_booth_types bt ON bt.id = b.booth_type_id
    WHERE a.event_id = v_event_id
    ORDER BY
      CASE bt.name
        WHEN 'Booth on the stage' THEN 0
        WHEN 'Corner Booth - Main Prayer Hall' THEN 1
        WHEN 'Regular Booth - Main Prayer Hall' THEN 2
        WHEN 'Booth in the entrance (Lobby)' THEN 3
        WHEN 'Coffee' THEN 4
        WHEN 'Food Vendors between the two buildings (Hot Meal)' THEN 5
        WHEN 'Mocktail/ Smoothie (outside)' THEN 6
        ELSE 9
      END,
      b.number
  LOOP
    v_target_name := CASE v_assignment.old_type_name
      WHEN 'Booth on the stage' THEN 'Stage table'
      WHEN 'Corner Booth - Main Prayer Hall' THEN 'Corner table'
      WHEN 'Regular Booth - Main Prayer Hall' THEN 'Regular table'
      WHEN 'Booth in the entrance (Lobby)' THEN 'Lobby table'
      WHEN 'Coffee' THEN 'Coffee (lobby or truck)'
      WHEN 'Food Vendors between the two buildings (Hot Meal)' THEN 'Hot meal (Outdoor)'
      WHEN 'Mocktail/ Smoothie (outside)' THEN 'Mocktail / smoothie (truck or cart)'
      ELSE NULL
    END;

    IF v_target_name IS NULL THEN
      CONTINUE;
    END IF;

    SELECT b.id
    INTO v_booth_id
    FROM public.vendor_hub_booths b
    JOIN public.vendor_hub_booth_types bt ON bt.id = b.booth_type_id
    WHERE b.event_id = v_event_id
      AND bt.name = v_target_name
      AND b.status = 'available'
    ORDER BY b.number
    LIMIT 1;

    IF v_booth_id IS NULL AND v_target_name = 'Regular table' THEN
      SELECT b.id
      INTO v_booth_id
      FROM public.vendor_hub_booths b
      JOIN public.vendor_hub_booth_types bt ON bt.id = b.booth_type_id
      WHERE b.event_id = v_event_id
        AND bt.name = 'Open table (no clothing)'
        AND b.status = 'available'
      ORDER BY b.number
      LIMIT 1;
    END IF;

    IF v_booth_id IS NULL THEN
      RAISE EXCEPTION 'No open booth left for % (%)', v_assignment.old_type_name, v_assignment.old_number;
    END IF;

    UPDATE public.vendor_hub_booths
    SET
      status = 'assigned',
      vendor_name = v_assignment.vendor_name
    WHERE id = v_booth_id;

    UPDATE public.vendor_hub_booth_assignments
    SET booth_id = v_booth_id
    WHERE id = v_assignment.id;
  END LOOP;

  DELETE FROM public.vendor_hub_booths b
  WHERE b.event_id = v_event_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.vendor_hub_booth_types bt
      WHERE bt.id = b.booth_type_id
        AND bt.event_id = v_event_id
        AND bt.name IN (
          SELECT name
          FROM public.vendor_hub_booth_types
          WHERE organization_id = v_org_id
            AND event_id IS NULL
        )
    );

  DELETE FROM public.vendor_hub_booth_types
  WHERE event_id = v_event_id
    AND name NOT IN (
      SELECT name
      FROM public.vendor_hub_booth_types
      WHERE organization_id = v_org_id
        AND event_id IS NULL
    );

  SELECT count(*) INTO v_total
  FROM public.vendor_hub_booths
  WHERE event_id = v_event_id;

  UPDATE public.vendor_hub_events
  SET total_booths = v_total
  WHERE id = v_event_id;
END $$;
