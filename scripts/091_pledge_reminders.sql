-- Pledge reminder settings and reminder activity tracking.
-- Run after 090_donation_receipts.sql

ALTER TABLE public.donation_settings
  ADD COLUMN IF NOT EXISTS enable_pledge_reminders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pledge_reminder_message TEXT,
  ADD COLUMN IF NOT EXISTS pledge_reminder_subject TEXT,
  ADD COLUMN IF NOT EXISTS pledge_reminder_schedule TEXT NOT NULL DEFAULT 'manual'
    CHECK (pledge_reminder_schedule IN ('manual', 'monthly', 'days_before_due')),
  ADD COLUMN IF NOT EXISTS pledge_reminder_days_before_due INTEGER,
  ADD COLUMN IF NOT EXISTS pledge_reminder_footer_text TEXT,
  ADD COLUMN IF NOT EXISTS pledge_payment_instructions TEXT;

CREATE TABLE IF NOT EXISTS public.pledge_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pledge_id UUID NOT NULL REFERENCES public.pledges(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  reminder_type TEXT NOT NULL
    CHECK (reminder_type IN ('manual', 'monthly', 'days_before_due', 'contacted')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'failed', 'skipped')),
  message_subject TEXT,
  message_body TEXT NOT NULL DEFAULT '',
  delivered_externally BOOLEAN NOT NULL DEFAULT false,
  contact_notes TEXT,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pledge_reminders_org_pledge_idx
  ON public.pledge_reminders (organization_id, pledge_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pledge_reminders_org_donor_idx
  ON public.pledge_reminders (organization_id, donor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pledge_reminders_org_status_idx
  ON public.pledge_reminders (organization_id, status);

ALTER TABLE public.pledge_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage pledge reminders" ON public.pledge_reminders;
CREATE POLICY "Org members manage pledge reminders"
  ON public.pledge_reminders FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS pledge_reminders_updated_at ON public.pledge_reminders;
CREATE TRIGGER pledge_reminders_updated_at
  BEFORE UPDATE ON public.pledge_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.pledge_reminders IS
  'Pledge collection reminder activity. Records are stored when staff send or log contact; external email delivery is tracked separately via delivered_externally.';

COMMENT ON COLUMN public.pledge_reminders.delivered_externally IS
  'True only when an outbound email provider actually delivered the message.';
