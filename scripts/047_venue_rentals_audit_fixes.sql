-- Phase A audit fixes for venue rentals workflow
-- Run after 046_venue_rentals_workflow.sql
-- Safe to re-run

-- ---------------------------------------------------------------------------
-- Customer RLS: allow submit flow to create child rows on own rentals
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customers view own rental reservations" ON public.rental_reservations;
CREATE POLICY "Customers view own rental reservations"
  ON public.rental_reservations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.venue_rentals vr
      WHERE vr.id = rental_reservations.venue_rental_id
        AND vr.customer_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers insert own rental reservations" ON public.rental_reservations;
CREATE POLICY "Customers insert own rental reservations"
  ON public.rental_reservations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.venue_rentals vr
      WHERE vr.id = rental_reservations.venue_rental_id
        AND vr.customer_user_id = auth.uid()
        AND vr.organization_id = rental_reservations.organization_id
    )
  );

DROP POLICY IF EXISTS "Customers view own selected addons" ON public.rental_selected_addons;
CREATE POLICY "Customers view own selected addons"
  ON public.rental_selected_addons FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.venue_rentals vr
      WHERE vr.id = rental_selected_addons.venue_rental_id
        AND vr.customer_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers insert own selected addons" ON public.rental_selected_addons;
CREATE POLICY "Customers insert own selected addons"
  ON public.rental_selected_addons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.venue_rentals vr
      WHERE vr.id = rental_selected_addons.venue_rental_id
        AND vr.customer_user_id = auth.uid()
        AND vr.organization_id = rental_selected_addons.organization_id
    )
  );

-- Customers may read active add-on catalog for their org (public rental options)
DROP POLICY IF EXISTS "Customers view active rental addons" ON public.rental_addons;
CREATE POLICY "Customers view active rental addons"
  ON public.rental_addons FOR SELECT
  USING (
    is_active = true
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      UNION
      SELECT organization_id FROM public.venue_rentals WHERE customer_user_id = auth.uid()
    )
  );

-- Optional link to prevent duplicate legacy + new rows for the same booking during migration
ALTER TABLE public.venue_rentals
  ADD COLUMN IF NOT EXISTS legacy_venue_booking_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS venue_rentals_legacy_booking_uidx
  ON public.venue_rentals(legacy_venue_booking_id)
  WHERE legacy_venue_booking_id IS NOT NULL;

COMMENT ON COLUMN public.venue_rentals.legacy_venue_booking_id IS
  'Set when migrating from venue_bookings to avoid running both reservation sync paths for one rental.';

-- Non-refundable deposit vs refundable security deposit (documentation constraints)
COMMENT ON COLUMN public.rental_payments.payment_type IS
  'deposit = non-refundable; security_deposit = refundable after staff post-event approval; refund rows only for security deposit returns.';
