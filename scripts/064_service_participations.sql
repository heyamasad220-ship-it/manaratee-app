-- Service participations: volunteers, childcare providers, vendors sign up for
-- confirmed internal events and active programs. Parent childcare registration
-- links via childcare_events.source_type / source_id.
-- Run after 063_internal_event_service_requirements.sql

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS requires_volunteers BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_childcare BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_vendors BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_requirements JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.programs.requires_childcare IS
  'When true and program is active, approved childcare providers can sign up to staff childcare.';

ALTER TABLE public.childcare_events
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS service_requirements JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.childcare_events
  DROP CONSTRAINT IF EXISTS childcare_events_source_type_check;

ALTER TABLE public.childcare_events
  ADD CONSTRAINT childcare_events_source_type_check
  CHECK (
    source_type IS NULL
    OR source_type IN ('standalone', 'internal_event', 'program')
  );

CREATE UNIQUE INDEX IF NOT EXISTS childcare_events_org_source_unique_idx
  ON public.childcare_events(organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL
    AND source_type IS NOT NULL
    AND source_type <> 'standalone';

ALTER TABLE public.childcare_registrations
  ADD COLUMN IF NOT EXISTS parent_contact_id UUID
  REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS childcare_registrations_parent_contact_idx
  ON public.childcare_registrations(organization_id, parent_contact_id)
  WHERE parent_contact_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.service_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('internal_event', 'program')),
  source_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  participation_type TEXT NOT NULL
    CHECK (participation_type IN ('volunteer', 'childcare_provider', 'vendor')),
  volunteer_role TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, source_type, source_id, contact_id, participation_type)
);

CREATE INDEX IF NOT EXISTS service_participations_org_source_idx
  ON public.service_participations(organization_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS service_participations_org_contact_idx
  ON public.service_participations(organization_id, contact_id);

CREATE INDEX IF NOT EXISTS service_participations_org_status_idx
  ON public.service_participations(organization_id, status);

ALTER TABLE public.service_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage service participations"
  ON public.service_participations;
CREATE POLICY "Org members manage service participations"
  ON public.service_participations FOR ALL
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

DROP POLICY IF EXISTS "Contacts view own service participations"
  ON public.service_participations;
CREATE POLICY "Contacts view own service participations"
  ON public.service_participations FOR SELECT
  USING (
    contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Contacts create own pending service participations"
  ON public.service_participations;
CREATE POLICY "Contacts create own pending service participations"
  ON public.service_participations FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
    AND organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Contacts view open internal event opportunities"
  ON public.internal_events;
CREATE POLICY "Contacts view open internal event opportunities"
  ON public.internal_events FOR SELECT
  USING (
    status = 'confirmed'
    AND (requires_volunteers OR requires_childcare OR requires_vendors)
    AND organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Contacts view active childcare events"
  ON public.childcare_events;
CREATE POLICY "Contacts view active childcare events"
  ON public.childcare_events FOR SELECT
  USING (
    is_active = true
    AND organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Contacts create own childcare registrations"
  ON public.childcare_registrations;
CREATE POLICY "Contacts create own childcare registrations"
  ON public.childcare_registrations FOR INSERT
  WITH CHECK (
    parent_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
    AND organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Contacts view own childcare registrations"
  ON public.childcare_registrations;
CREATE POLICY "Contacts view own childcare registrations"
  ON public.childcare_registrations FOR SELECT
  USING (
    parent_contact_id IN (SELECT id FROM public.contacts WHERE auth_user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS service_participations_updated_at ON public.service_participations;
CREATE TRIGGER service_participations_updated_at
  BEFORE UPDATE ON public.service_participations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
