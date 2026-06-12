-- Approved vendors can self-reserve booths on published bazaar events (org-once model)
-- Run in Supabase SQL Editor after 079_vendor_portal_rls.sql

CREATE OR REPLACE FUNCTION public.is_approved_org_vendor(
  p_organization_id UUID,
  p_contact_id UUID
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.organization_id = p_organization_id
      AND a.contact_id = p_contact_id
      AND a.module_owner = 'vendor_hub'
      AND a.application_type = 'vendor'
      AND a.status = 'approved'
  )
  OR EXISTS (
    SELECT 1
    FROM public.contact_roles cr
    WHERE cr.organization_id = p_organization_id
      AND cr.contact_id = p_contact_id
      AND cr.role = 'vendor'
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_org_vendor(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved_org_vendor(UUID, UUID) TO authenticated;

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
    SELECT COALESCE(price, 0)
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

REVOKE ALL ON FUNCTION public.reserve_vendor_booth(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_vendor_booth(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.reserve_vendor_booth IS
  'Approved org vendors reserve an available booth on a published bazaar without re-applying.';
