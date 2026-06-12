-- Post-event vendor participation evaluations (organizer-only, internal)
-- Run in Supabase SQL Editor after 081_vendor_booth_pay_now.sql

CREATE TABLE IF NOT EXISTS public.vendor_hub_participation_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_hub_event_id UUID NOT NULL REFERENCES public.vendor_hub_events(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  booth_assignment_id UUID REFERENCES public.vendor_hub_booth_assignments(id) ON DELETE SET NULL,
  rating TEXT NOT NULL
    CHECK (rating IN ('excellent', 'good', 'average', 'poor')),
  would_invite_again BOOLEAN,
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_hub_event_id, contact_id)
);

CREATE INDEX IF NOT EXISTS vendor_hub_participation_evaluations_event_idx
  ON public.vendor_hub_participation_evaluations(vendor_hub_event_id);

CREATE INDEX IF NOT EXISTS vendor_hub_participation_evaluations_contact_idx
  ON public.vendor_hub_participation_evaluations(contact_id);

CREATE INDEX IF NOT EXISTS vendor_hub_participation_evaluations_org_idx
  ON public.vendor_hub_participation_evaluations(organization_id);

ALTER TABLE public.vendor_hub_participation_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage vendor participation evaluations"
  ON public.vendor_hub_participation_evaluations;
CREATE POLICY "Org members manage vendor participation evaluations"
  ON public.vendor_hub_participation_evaluations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS vendor_hub_participation_evaluations_updated_at
  ON public.vendor_hub_participation_evaluations;
CREATE TRIGGER vendor_hub_participation_evaluations_updated_at
  BEFORE UPDATE ON public.vendor_hub_participation_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.vendor_hub_participation_evaluations IS
  'Organizer evaluation of vendor participation per bazaar event. Internal staff use only.';
