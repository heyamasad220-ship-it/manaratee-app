-- Customer rental visibility: payments, contracts, guest count
-- Run after 051_finance_permissions.sql
-- Safe to re-run

-- Guest count on rental (customer-safe; synced from setup on submit)
ALTER TABLE public.venue_rentals
  ADD COLUMN IF NOT EXISTS expected_attendance INTEGER;

-- Backfill from operational briefs where available
UPDATE public.venue_rentals vr
SET expected_attendance = ob.expected_attendance
FROM public.operational_briefs ob
WHERE ob.source_type = 'venue_rental'
  AND ob.source_id = vr.id
  AND ob.expected_attendance IS NOT NULL
  AND vr.expected_attendance IS NULL;

-- Customers may view payments for their own rentals (read-only)
DROP POLICY IF EXISTS "Customers view own rental payments" ON public.rental_payments;
CREATE POLICY "Customers view own rental payments"
  ON public.rental_payments FOR SELECT
  USING (
    venue_rental_id IN (
      SELECT id FROM public.venue_rentals WHERE customer_user_id = auth.uid()
    )
  );

-- Customers may view contracts for their own rentals (read-only)
DROP POLICY IF EXISTS "Customers view own rental contracts" ON public.rental_contracts;
CREATE POLICY "Customers view own rental contracts"
  ON public.rental_contracts FOR SELECT
  USING (
    venue_rental_id IN (
      SELECT id FROM public.venue_rentals WHERE customer_user_id = auth.uid()
    )
  );
