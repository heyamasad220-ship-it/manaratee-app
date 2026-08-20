-- Youth check-in/out on childcare registrations + waitlisted ticket status.
-- Run after 252_event_workspace_redesign.sql.

-- 1) Youth check-in fields on childcare_registrations
ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES auth.users(id);

ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS checked_out_by UUID REFERENCES auth.users(id);

ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS pickup_authorization TEXT;

COMMENT ON COLUMN public.childcare_registrations.pickup_authorization IS
  'Who may pick up the child (guardian name, relationship, etc.).';

-- 2) Allow waitlisted tickets for event registration waitlist
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('valid', 'checked_in', 'waitlisted', 'canceled', 'refunded'));
