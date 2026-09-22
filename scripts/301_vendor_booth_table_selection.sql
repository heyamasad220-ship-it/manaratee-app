-- Table-selection fees + numbered booths on bazaar templates.
-- Self-serve reservation charges type.price + type.selection_fee.
-- Run in Supabase SQL Editor after 234 / 078 / 080.

ALTER TABLE public.vendor_hub_booth_types
  ADD COLUMN IF NOT EXISTS selection_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_hub_booth_setup_template_lines
  ADD COLUMN IF NOT EXISTS selection_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_hub_booth_setup_template_lines
  ADD COLUMN IF NOT EXISTS booth_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendor_hub_booth_types.selection_fee IS
  'Extra charged when a vendor picks this numbered table (regular $10, corner $25).';

COMMENT ON COLUMN public.vendor_hub_booth_setup_template_lines.booth_numbers IS
  'Optional explicit booth numbers (e.g. ["T1","T2"]). Empty array auto-numbers.';

CREATE OR REPLACE FUNCTION public.reserve_vendor_booth(
  p_event_id UUID,
  p_booth_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_contact_id UUID;
  v_org_id UUID;
  v_event_org_id UUID;
  v_calendar_status TEXT;
  v_booth_event_id UUID;
  v_booth_status TEXT;
  v_booth_type_id UUID;
  v_fee NUMERIC(10, 2);
  v_assignment_id UUID;
  v_participant_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to reserve a booth.';
  END IF;

  SELECT id, organization_id
  INTO v_contact_id, v_org_id
  FROM public.contacts
  WHERE auth_user_id = v_user_id
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'No contact profile linked to your account.';
  END IF;

  SELECT organization_id, calendar_status
  INTO v_event_org_id, v_calendar_status
  FROM public.vendor_hub_events
  WHERE id = p_event_id;

  IF v_event_org_id IS NULL THEN
    RAISE EXCEPTION 'Bazaar event not found.';
  END IF;

  IF v_event_org_id IS DISTINCT FROM v_org_id THEN
    SELECT c.id, c.organization_id
    INTO v_contact_id, v_org_id
    FROM public.contacts c
    WHERE c.auth_user_id = v_user_id
      AND c.organization_id = v_event_org_id
    LIMIT 1;

    IF v_contact_id IS NULL THEN
      RAISE EXCEPTION 'You are not linked to this organization.';
    END IF;
  END IF;

  IF NOT public.is_approved_org_vendor(v_org_id, v_contact_id) THEN
    RAISE EXCEPTION 'You must be an approved vendor for this organization before reserving a booth.';
  END IF;

  IF v_calendar_status IS NULL
     OR v_calendar_status NOT IN ('community_visible', 'published') THEN
    RAISE EXCEPTION 'This bazaar is not open for vendor reservations yet.';
  END IF;

  SELECT event_id, status, booth_type_id
  INTO v_booth_event_id, v_booth_status, v_booth_type_id
  FROM public.vendor_hub_booths
  WHERE id = p_booth_id
  FOR UPDATE;

  IF v_booth_event_id IS NULL OR v_booth_event_id <> p_event_id THEN
    RAISE EXCEPTION 'Booth not found for this event.';
  END IF;

  IF v_booth_status IS DISTINCT FROM 'available' THEN
    RAISE EXCEPTION 'This booth is no longer available.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vendor_hub_booth_assignments ba
    WHERE ba.event_id = p_event_id
      AND ba.contact_id = v_contact_id
      AND ba.status IN ('assigned', 'confirmed', 'reserved')
  ) THEN
    RAISE EXCEPTION 'You already have a booth assignment for this bazaar.';
  END IF;

  v_fee := 0;
  IF v_booth_type_id IS NOT NULL THEN
    SELECT COALESCE(price, 0) + COALESCE(selection_fee, 0)
    INTO v_fee
    FROM public.vendor_hub_booth_types
    WHERE id = v_booth_type_id;
  END IF;

  UPDATE public.vendor_hub_booths
  SET status = 'reserved',
      updated_at = NOW()
  WHERE id = p_booth_id;

  INSERT INTO public.vendor_hub_booth_assignments (
    event_id,
    booth_id,
    contact_id,
    fee_amount,
    status
  )
  VALUES (
    p_event_id,
    p_booth_id,
    v_contact_id,
    v_fee,
    'reserved'
  )
  RETURNING id INTO v_assignment_id;

  SELECT id INTO v_participant_id
  FROM public.vendor_hub_participant_status
  WHERE vendor_hub_event_id = p_event_id
    AND contact_id = v_contact_id
  LIMIT 1;

  IF v_participant_id IS NULL THEN
    INSERT INTO public.vendor_hub_participant_status (
      organization_id,
      vendor_hub_event_id,
      contact_id,
      lifecycle_status
    )
    VALUES (
      v_org_id,
      p_event_id,
      v_contact_id,
      'payment_pending'
    );
  ELSE
    UPDATE public.vendor_hub_participant_status
    SET lifecycle_status = 'payment_pending',
        updated_at = NOW()
    WHERE id = v_participant_id;
  END IF;

  RETURN v_assignment_id;
END;
$$;

-- MAS Dallas hall map: books/toys tables cannot use clothing racks.
INSERT INTO public.vendor_hub_booth_attributes (
  organization_id, name, slug, category, description, is_active, sort_order
)
SELECT
  'e057e00a-e4e3-4adf-9af5-f465db1894be',
  'No clothing / no racks',
  'no-clothing',
  'environment',
  'Books, toys, and other goods that do not need clothing racks.',
  true,
  40
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendor_hub_booth_attributes
  WHERE organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
    AND slug = 'no-clothing'
);

INSERT INTO public.vendor_hub_booth_setup_templates (
  organization_id, name, slug, description, is_active, sort_order
)
SELECT
  'e057e00a-e4e3-4adf-9af5-f465db1894be',
  'MAS Dallas Fall Bazaar layout',
  'mas-dallas-fall-bazaar-layout',
  'Main hall T1–T27, 6 lobby tables, coffee (lobby or truck), outdoor trucks, and between-buildings spots. Vendors pick a numbered table: +$10, corners +$25.',
  true,
  0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendor_hub_booth_setup_templates
  WHERE organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
    AND slug = 'mas-dallas-fall-bazaar-layout'
);

INSERT INTO public.vendor_hub_booth_setup_template_lines (
  template_id, line_name, price, selection_fee, color, quantity, capacity,
  location, description, sort_order, attribute_slugs, booth_numbers
)
SELECT
  t.id,
  v.line_name,
  v.price,
  v.selection_fee,
  v.color,
  v.quantity,
  v.quantity,
  v.location,
  v.description,
  v.sort_order,
  v.attribute_slugs::jsonb,
  v.booth_numbers::jsonb
FROM public.vendor_hub_booth_setup_templates t
CROSS JOIN (
  VALUES
    (
      'Stage table'::text, 150::numeric, 10::numeric, '#f97316'::text, 3, 'Main Prayer Hall (stage)'::text,
      'Orange T1–T3 on the stage.'::text, 0,
      '["near-stage","indoor"]'::text,
      '["T1","T2","T3"]'::text
    ),
    (
      'Corner table', 150, 25, '#ec4899', 2, 'Main Prayer Hall',
      'Pink T15 and T25. Selecting a corner is $25 extra.', 1,
      '["corner-booth","indoor"]',
      '["T15","T25"]'
    ),
    (
      'Regular table', 150, 10, '#22c55e', 12, 'Main Prayer Hall',
      'Green regular hall tables.', 2,
      '["indoor"]',
      '["T14","T16","T17","T18","T19","T20","T21","T22","T23","T24","T26","T27"]'
    ),
    (
      'Open table (no clothing)', 150, 10, '#38bdf8', 10, 'Main Prayer Hall',
      'Blue T4–T13. Books, toys, and goods that do not need clothing racks.', 3,
      '["no-clothing","indoor"]',
      '["T4","T5","T6","T7","T8","T9","T10","T11","T12","T13"]'
    ),
    (
      'Lobby table', 300, 0, '#d97706', 6, 'Main Lobby',
      'Maximum exposure. $300 includes picking a lobby table.', 4,
      '["near-entrance","premium-location","indoor"]',
      '["L1","L2","L3","L4","L5","L6"]'
    ),
    (
      'Coffee (lobby or truck)', 300, 0, '#92400e', 1, 'Lobby or outside truck',
      'One coffee slot — cart in the lobby or a coffee truck, not both.', 5,
      '["premium-location"]',
      '["COFF-1"]'
    ),
    (
      'Ice cream truck', 125, 0, '#06b6d4', 1, 'Outside',
      'One ice cream truck of up to four outdoor trucks.', 6,
      '["outdoor","vehicle-access"]',
      '["ICE-1"]'
    ),
    (
      'Hot food truck', 275, 0, '#dc2626', 3, 'Outside',
      'Hot-food trucks (use three when coffee is in the lobby so total trucks stay at four).', 7,
      '["outdoor","vehicle-access"]',
      '["TRK-1","TRK-2","TRK-3"]'
    ),
    (
      'Hot meal (between buildings)', 275, 0, '#b91c1c', 6, 'Between the two buildings',
      'Six hot-meal spots between the buildings.', 8,
      '["outdoor"]',
      '["HM-1","HM-2","HM-3","HM-4","HM-5","HM-6"]'
    ),
    (
      'Henna', 100, 0, '#a855f7', 1, 'Between the two buildings',
      'One henna table.', 9,
      '["outdoor"]',
      '["HN-1"]'
    ),
    (
      'Face painting', 100, 0, '#f472b6', 1, 'Between the two buildings',
      'One face-painting table.', 10,
      '["outdoor"]',
      '["FP-1"]'
    ),
    (
      'General merchandise (between buildings)', 100, 10, '#65a30d', 4, 'Between the two buildings',
      'Four general merchandise tables. +$10 to pick a specific table.', 11,
      '["outdoor"]',
      '["GM-1","GM-2","GM-3","GM-4"]'
    )
) AS v(
  line_name, price, selection_fee, color, quantity, location, description, sort_order,
  attribute_slugs, booth_numbers
)
WHERE t.organization_id = 'e057e00a-e4e3-4adf-9af5-f465db1894be'
  AND t.slug = 'mas-dallas-fall-bazaar-layout'
  AND NOT EXISTS (
    SELECT 1
    FROM public.vendor_hub_booth_setup_template_lines l
    WHERE l.template_id = t.id
  );

NOTIFY pgrst, 'reload schema';
