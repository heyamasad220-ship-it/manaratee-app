-- How staff reached the donor on a manual contact log: call or text.
-- Safe to re-run.

ALTER TABLE public.pledge_reminders
  ADD COLUMN IF NOT EXISTS contact_method TEXT
    CHECK (contact_method IS NULL OR contact_method IN ('call', 'text'));

COMMENT ON COLUMN public.pledge_reminders.contact_method IS
  'Call or text for reminder_type = contacted. Null on email reminders and older contact logs.';
