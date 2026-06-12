-- Per-organization notification preferences for Event Management and Venue Rentals
-- Run after 071_vendor_hub_operations.sql

CREATE TABLE IF NOT EXISTS public.module_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL CHECK (module_key IN ('event_management', 'venue_rentals')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, module_key)
);

CREATE INDEX IF NOT EXISTS module_notification_settings_org_idx
  ON public.module_notification_settings(organization_id);

ALTER TABLE public.module_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage module notification settings"
  ON public.module_notification_settings;
CREATE POLICY "Org members manage module notification settings"
  ON public.module_notification_settings FOR ALL
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

DROP TRIGGER IF EXISTS module_notification_settings_updated_at
  ON public.module_notification_settings;
CREATE TRIGGER module_notification_settings_updated_at
  BEFORE UPDATE ON public.module_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
