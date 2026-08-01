-- Venue Rentals org policies (Settings → Policies).
-- Per-tenant: optional refundable security deposit workflow.
-- Default OFF — orgs that keep a card on file for incidentals stay lean.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.venue_rental_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  security_deposit_enabled BOOLEAN NOT NULL DEFAULT false,
  default_security_deposit_amount NUMERIC(12, 2)
    CHECK (
      default_security_deposit_amount IS NULL
      OR default_security_deposit_amount >= 0
    ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.venue_rental_settings IS
  'Per-org Venue Rentals policies. When security_deposit_enabled, staff can collect a refundable security deposit and run post-event refund approval.';

COMMENT ON COLUMN public.venue_rental_settings.security_deposit_enabled IS
  'When true, show security deposit on approve/record payment and post-event refund workflow. When false, use card-on-file / add charges for incidentals.';

COMMENT ON COLUMN public.venue_rental_settings.default_security_deposit_amount IS
  'Optional default amount prefilled when approving a rental (only used if security deposits are enabled).';

ALTER TABLE public.venue_rental_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage venue rental settings"
  ON public.venue_rental_settings;
CREATE POLICY "Org members manage venue rental settings"
  ON public.venue_rental_settings FOR ALL
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

DROP TRIGGER IF EXISTS venue_rental_settings_updated_at
  ON public.venue_rental_settings;
CREATE TRIGGER venue_rental_settings_updated_at
  BEFORE UPDATE ON public.venue_rental_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
