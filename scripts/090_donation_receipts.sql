-- Donation receipt settings and receipt tracking (canonical payments only).
-- Run after 089_campaign_goals.sql

CREATE TABLE IF NOT EXISTS public.donation_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  tax_id TEXT,
  receipt_footer_text TEXT,
  authorized_signer_name TEXT,
  authorized_signer_title TEXT,
  receipt_email_template TEXT,
  receipt_number_prefix TEXT NOT NULL DEFAULT 'REC',
  receipt_number_format TEXT NOT NULL DEFAULT '{prefix}-{year}-{sequence}',
  next_receipt_sequence INTEGER NOT NULL DEFAULT 1,
  auto_generate_receipts BOOLEAN NOT NULL DEFAULT false,
  email_receipts_automatically BOOLEAN NOT NULL DEFAULT false,
  generate_year_end_statements BOOLEAN NOT NULL DEFAULT true,
  year_end_statement_threshold NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.donation_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('payment', 'annual_statement')),
  receipt_number TEXT NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  tax_year INTEGER,
  amount NUMERIC(12, 2) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'not_sent'
    CHECK (status IN ('not_sent', 'sent', 'resent')),
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, receipt_number),
  UNIQUE (organization_id, payment_id)
);

CREATE INDEX IF NOT EXISTS donation_receipts_org_status_idx
  ON public.donation_receipts (organization_id, status);

CREATE INDEX IF NOT EXISTS donation_receipts_org_donor_year_idx
  ON public.donation_receipts (organization_id, donor_id, tax_year);

CREATE INDEX IF NOT EXISTS donation_receipts_org_payment_idx
  ON public.donation_receipts (organization_id, payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donation_receipts_annual_unique_idx
  ON public.donation_receipts (organization_id, donor_id, tax_year)
  WHERE receipt_type = 'annual_statement' AND donor_id IS NOT NULL AND tax_year IS NOT NULL;

ALTER TABLE public.donation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage donation settings" ON public.donation_settings;
CREATE POLICY "Org members manage donation settings"
  ON public.donation_settings FOR ALL
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

DROP POLICY IF EXISTS "Org members manage donation receipts" ON public.donation_receipts;
CREATE POLICY "Org members manage donation receipts"
  ON public.donation_receipts FOR ALL
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

DROP TRIGGER IF EXISTS donation_settings_updated_at ON public.donation_settings;
CREATE TRIGGER donation_settings_updated_at
  BEFORE UPDATE ON public.donation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS donation_receipts_updated_at ON public.donation_receipts;
CREATE TRIGGER donation_receipts_updated_at
  BEFORE UPDATE ON public.donation_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.donation_settings IS
  'Per-organization donation receipt and year-end statement configuration.';

COMMENT ON TABLE public.donation_receipts IS
  'Generated receipts from canonical payments only. Pledges without payments do not create rows.';
