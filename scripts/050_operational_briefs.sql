-- Operational Brief / Facility Setup Brief foundation
-- Run after 049_facilities_navigation.sql
-- Safe to re-run

CREATE TABLE IF NOT EXISTS public.operational_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('internal_event', 'venue_rental', 'program', 'maintenance')
  ),
  source_id UUID,
  reservation_id UUID REFERENCES public.resource_reservations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  primary_contact_person_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  primary_contact_name TEXT,
  primary_contact_phone TEXT,
  internal_coordinator_person_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  internal_coordinator_name TEXT,
  internal_coordinator_phone TEXT,
  internal_coordinator_email TEXT,
  expected_attendance INTEGER,
  setup_style TEXT,
  room_setup_notes TEXT,
  equipment_notes TEXT,
  food_beverage_notes TEXT,
  table_linen_notes TEXT,
  cleanup_notes TEXT,
  accessibility_notes TEXT,
  special_requests TEXT,
  facility_notes TEXT,
  setup_status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    setup_status IN (
      'not_started',
      'needs_review',
      'ready_for_setup',
      'setup_in_progress',
      'setup_complete',
      'issue_reported',
      'closed'
    )
  ),
  source_status TEXT,
  visibility_level TEXT NOT NULL DEFAULT 'staff' CHECK (
    visibility_level IN ('staff', 'facilities', 'coordinators')
  ),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS operational_briefs_org_source_idx
  ON public.operational_briefs(organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS operational_briefs_reservation_idx
  ON public.operational_briefs(reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operational_briefs_org_setup_status_idx
  ON public.operational_briefs(organization_id, setup_status);

CREATE INDEX IF NOT EXISTS operational_briefs_org_event_date_idx
  ON public.operational_briefs(organization_id, event_date);

ALTER TABLE public.operational_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view operational briefs" ON public.operational_briefs;
CREATE POLICY "Org members view operational briefs"
  ON public.operational_briefs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage operational briefs" ON public.operational_briefs;
CREATE POLICY "Org members manage operational briefs"
  ON public.operational_briefs FOR ALL
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

DROP TRIGGER IF EXISTS operational_briefs_updated_at ON public.operational_briefs;
CREATE TRIGGER operational_briefs_updated_at
  BEFORE UPDATE ON public.operational_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.operational_briefs IS
  'Facility setup / operational visibility layer. No payment or contract fields. '
  'Linked to business modules via source_type + source_id or reservation_id for blocks.';
