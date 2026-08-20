-- Event documents (agenda, waivers, permits) attached to an internal event.
-- Run after 253_event_youth_checkin_waitlist.sql. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.event_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  internal_event_id UUID NOT NULL REFERENCES public.internal_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  mime_type TEXT,
  file_size INTEGER,
  visibility TEXT NOT NULL DEFAULT 'staff'
    CHECK (visibility IN ('staff', 'public')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_documents_org_event_idx
  ON public.event_documents(organization_id, internal_event_id, sort_order);

COMMENT ON TABLE public.event_documents IS
  'Files attached to an internal event (staff-only or public).';

ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage event documents" ON public.event_documents;
CREATE POLICY "Org members manage event documents"
  ON public.event_documents FOR ALL
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

NOTIFY pgrst, 'reload schema';
