-- Transactional email delivery for donation operational emails (receipts, statements, pledge reminders).
-- Run after 093_stripe_one_time_donations.sql

ALTER TABLE public.donation_receipts
  DROP CONSTRAINT IF EXISTS donation_receipts_status_check;

ALTER TABLE public.donation_receipts
  ADD CONSTRAINT donation_receipts_status_check
  CHECK (status IN ('not_sent', 'sent', 'resent', 'failed'));

ALTER TABLE public.donation_settings
  ADD COLUMN IF NOT EXISTS year_end_statement_email_template TEXT;

CREATE TABLE IF NOT EXISTS public.transactional_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  template TEXT NOT NULL
    CHECK (template IN ('receipt', 'year_end_statement', 'pledge_reminder')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider TEXT NOT NULL CHECK (provider IN ('resend', 'console')),
  provider_message_id TEXT,
  related_entity_type TEXT
    CHECK (related_entity_type IN ('donation_receipt', 'pledge_reminder')),
  related_entity_id UUID,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactional_email_log_org_template_idx
  ON public.transactional_email_log (organization_id, template, created_at DESC);

CREATE INDEX IF NOT EXISTS transactional_email_log_entity_idx
  ON public.transactional_email_log (related_entity_type, related_entity_id);

ALTER TABLE public.transactional_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view transactional email log" ON public.transactional_email_log;
CREATE POLICY "Org members view transactional email log"
  ON public.transactional_email_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.transactional_email_log IS
  'Audit log for operational donation emails (receipts, year-end statements, pledge reminders).';
