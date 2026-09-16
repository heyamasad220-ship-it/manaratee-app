-- Event Management org policies (Settings → General).
-- Per-tenant: optional on-site event approval.
-- Default OFF — orgs that do not review Center events stay live on submit.
-- Online and External Venue never use this flag.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.event_management_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  approval_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.event_management_settings IS
  'Per-org Event Management policies. When approval_required is true, on-site (Center) events wait for approval. Online and External Venue never wait.';

COMMENT ON COLUMN public.event_management_settings.approval_required IS
  'When true, Center/on-site events submit as awaiting_approval. Default false. Does not apply to online or external venue events.';

ALTER TABLE public.event_management_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage event management settings"
  ON public.event_management_settings;
CREATE POLICY "Org members manage event management settings"
  ON public.event_management_settings FOR ALL
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

DROP TRIGGER IF EXISTS event_management_settings_updated_at
  ON public.event_management_settings;
CREATE TRIGGER event_management_settings_updated_at
  BEFORE UPDATE ON public.event_management_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

NOTIFY pgrst, 'reload schema';
