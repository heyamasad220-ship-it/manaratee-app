-- Workforce credentials + childcare event provider assignments
-- Run after 058_membership_module.sql
-- Safe to re-run

CREATE TABLE IF NOT EXISTS public.workforce_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL
    CHECK (credential_type IN (
      'cpr',
      'first_aid',
      'background_check',
      'safeguarding',
      'other'
    )),
  label TEXT,
  issued_date DATE,
  expires_date DATE,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workforce_credentials_org_contact_idx
  ON public.workforce_credentials(organization_id, contact_id);

CREATE INDEX IF NOT EXISTS workforce_credentials_org_expires_idx
  ON public.workforce_credentials(organization_id, expires_date)
  WHERE expires_date IS NOT NULL;

COMMENT ON TABLE public.workforce_credentials IS
  'CPR, First Aid, background checks, and other workforce credentials for volunteers and childcare providers.';

ALTER TABLE public.childcare_events
  ADD COLUMN IF NOT EXISTS assigned_provider_contact_id UUID
    REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS childcare_events_assigned_provider_idx
  ON public.childcare_events(organization_id, assigned_provider_contact_id)
  WHERE assigned_provider_contact_id IS NOT NULL;

COMMENT ON COLUMN public.childcare_events.assigned_provider_contact_id IS
  'Approved childcare provider contact assigned to staff this event.';

ALTER TABLE public.workforce_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view workforce credentials" ON public.workforce_credentials;
CREATE POLICY "Organization members can view workforce credentials"
ON public.workforce_credentials FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can manage workforce credentials" ON public.workforce_credentials;
CREATE POLICY "Organization members can manage workforce credentials"
ON public.workforce_credentials FOR ALL
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

DROP TRIGGER IF EXISTS workforce_credentials_updated_at ON public.workforce_credentials;
CREATE TRIGGER workforce_credentials_updated_at
  BEFORE UPDATE ON public.workforce_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Rename HR module display name to Workforce
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    UPDATE public.modules
    SET name = 'Workforce',
        description = COALESCE(description, 'Employees, volunteers, and childcare providers')
    WHERE slug IN ('workforce', 'hr')
      AND name IN ('HR', 'People Management', 'Organization');
  END IF;
END $$;
