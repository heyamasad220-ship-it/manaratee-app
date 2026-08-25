-- Allow refunded rows on program_charge_schedule.
-- The staff refund action and Reports → Transactions already use status='refunded',
-- but the check constraint only allowed scheduled/due/paid/waived/void/adjusted/past_due.

ALTER TABLE public.program_charge_schedule
  DROP CONSTRAINT IF EXISTS program_charge_schedule_status_check;

ALTER TABLE public.program_charge_schedule
  ADD CONSTRAINT program_charge_schedule_status_check
  CHECK (
    status IN (
      'scheduled',
      'due',
      'paid',
      'waived',
      'void',
      'adjusted',
      'past_due',
      'refunded'
    )
  );
