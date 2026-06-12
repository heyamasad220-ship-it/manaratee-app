-- Vendor self-serve booth fee payment (Pay Now)
-- Run in Supabase SQL Editor after 080_vendor_booth_reservation.sql

CREATE OR REPLACE FUNCTION public.pay_vendor_booth_fee(
  p_assignment_id UUID,
  p_payment_method TEXT DEFAULT 'online'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_assignment RECORD;
  v_fee NUMERIC(10, 2);
  v_paid NUMERIC(10, 2);
  v_balance NUMERIC(10, 2);
  v_payment_id UUID;
  v_participant_id UUID;
  v_method TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to pay.';
  END IF;

  SELECT ba.id,
         ba.event_id,
         ba.booth_id,
         ba.contact_id,
         ba.fee_amount,
         ba.status
  INTO v_assignment
  FROM public.vendor_hub_booth_assignments ba
  WHERE ba.id = p_assignment_id
  FOR UPDATE;

  IF v_assignment.id IS NULL THEN
    RAISE EXCEPTION 'Booth assignment not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = v_assignment.contact_id
      AND c.auth_user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You can only pay for your own booth assignment.';
  END IF;

  IF v_assignment.status IN ('cancelled', 'withdrawn') THEN
    RAISE EXCEPTION 'This booth assignment is no longer active.';
  END IF;

  v_fee := COALESCE(v_assignment.fee_amount, 0);

  SELECT COALESCE(SUM(
    CASE
      WHEN p.payment_type = 'refund' THEN -ABS(p.amount)
      ELSE ABS(p.amount)
    END
  ), 0)
  INTO v_paid
  FROM public.vendor_hub_payments p
  WHERE p.booth_assignment_id = p_assignment_id;

  v_balance := v_fee - v_paid;

  IF v_balance <= 0 THEN
    UPDATE public.vendor_hub_booth_assignments
    SET status = 'confirmed',
        updated_at = NOW()
    WHERE id = p_assignment_id
      AND status = 'reserved';

    UPDATE public.vendor_hub_participant_status
    SET lifecycle_status = 'paid',
        updated_at = NOW()
    WHERE vendor_hub_event_id = v_assignment.event_id
      AND contact_id = v_assignment.contact_id;

    IF v_assignment.booth_id IS NOT NULL THEN
      UPDATE public.vendor_hub_booths
      SET status = 'assigned',
          updated_at = NOW()
      WHERE id = v_assignment.booth_id
        AND status IN ('reserved', 'available');
    END IF;

    SELECT id INTO v_payment_id
    FROM public.vendor_hub_payments
    WHERE booth_assignment_id = p_assignment_id
      AND payment_type = 'payment'
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN v_payment_id;
  END IF;

  v_method := NULLIF(trim(p_payment_method), '');
  IF v_method IS NULL THEN
    v_method := 'online';
  END IF;

  INSERT INTO public.vendor_hub_payments (
    event_id,
    booth_assignment_id,
    contact_id,
    amount,
    payment_method,
    payment_date,
    payment_type,
    notes
  )
  VALUES (
    v_assignment.event_id,
    p_assignment_id,
    v_assignment.contact_id,
    v_balance,
    v_method,
    CURRENT_DATE,
    'payment',
    'Vendor self-serve Pay Now'
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.vendor_hub_booth_assignments
  SET status = 'confirmed',
      updated_at = NOW()
  WHERE id = p_assignment_id;

  UPDATE public.vendor_hub_participant_status
  SET lifecycle_status = 'paid',
      updated_at = NOW()
  WHERE vendor_hub_event_id = v_assignment.event_id
    AND contact_id = v_assignment.contact_id;

  IF v_assignment.booth_id IS NOT NULL THEN
    UPDATE public.vendor_hub_booths
    SET status = 'assigned',
        updated_at = NOW()
    WHERE id = v_assignment.booth_id
      AND status IN ('reserved', 'available');
  END IF;

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_vendor_booth_fee(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_vendor_booth_fee(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.pay_vendor_booth_fee IS
  'Vendor pays remaining booth fee for their assignment; marks participation paid and booth assigned.';
