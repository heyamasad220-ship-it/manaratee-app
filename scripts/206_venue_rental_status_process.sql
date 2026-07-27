-- Venue rental intended process statuses (July 2026)
-- Run in Supabase SQL Editor after 046_venue_rentals_workflow.sql
--
-- Process:
--   submitted → pending (need more info) | approved_pending_payment | declined
--   deposit paid → confirmed (security deposit not required for confirmation)
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Expand status CHECK to include `pending`
-- ---------------------------------------------------------------------------
ALTER TABLE public.venue_rentals
  DROP CONSTRAINT IF EXISTS venue_rentals_status_check;

ALTER TABLE public.venue_rentals
  ADD CONSTRAINT venue_rentals_status_check CHECK (
    status IN (
      'draft',
      'submitted',
      'pending',
      'awaiting_supervisor_approval', -- legacy alias; prefer submitted / pending
      'declined',
      'approved_pending_payment',
      'hold_expired',
      'deposit_paid', -- legacy; prefer confirmed after deposit
      'security_deposit_paid', -- legacy; not required for confirmation
      'confirmed',
      'cancelled_before_payment',
      'cancelled_after_payment',
      'completed',
      'awaiting_security_deposit_refund_approval',
      'security_deposit_refunded',
      'closed'
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Align existing rows to the intended process
-- ---------------------------------------------------------------------------
-- Review queue: old "awaiting supervisor" → submitted (admin has not acted yet)
UPDATE public.venue_rentals
SET status = 'submitted',
    updated_at = NOW()
WHERE status = 'awaiting_supervisor_approval';

-- Deposit paid means booking is confirmed
UPDATE public.venue_rentals
SET status = 'confirmed',
    hold_expires_at = NULL,
    updated_at = NOW()
WHERE status IN ('deposit_paid', 'security_deposit_paid');

-- Confirm reservations for newly confirmed rentals
UPDATE public.rental_reservations rr
SET status = 'confirmed',
    hold_expires_at = NULL,
    updated_at = NOW()
WHERE rr.status = 'temporary_hold'
  AND EXISTS (
    SELECT 1
    FROM public.venue_rentals vr
    WHERE vr.id = rr.venue_rental_id
      AND vr.status = 'confirmed'
  );

COMMENT ON COLUMN public.venue_rentals.status IS
  'Intended process: submitted → pending|approved_pending_payment|declined; deposit paid → confirmed. Legacy deposit_paid / security_deposit_paid / awaiting_supervisor_approval retained in CHECK for safety.';
