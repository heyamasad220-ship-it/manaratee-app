-- Event Workspace redesign foundation (safe to re-run).
-- Adds feature toggles, coordinator, audience/tags, expenses ledger.
-- Preserves existing requires_* flags and ticketing data.

-- 1) Workspace feature toggles + metadata on internal_events
ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS workspace_features JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS audience TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS event_tags TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS coordinator_contact_id UUID
    REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS estimated_attendance INTEGER;

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

COMMENT ON COLUMN public.internal_events.workspace_features IS
  'Event Workspace module toggles: registration, staff, youth, vendors, finance, waitlist.';
COMMENT ON COLUMN public.internal_events.audience IS
  'Public audience tags (Everyone, Families, Youth, …).';
COMMENT ON COLUMN public.internal_events.event_tags IS
  'Search/filter tags (Fundraiser, Education, …) — not event_type.';
COMMENT ON COLUMN public.internal_events.coordinator_contact_id IS
  'Primary event coordinator (contacts).';
COMMENT ON COLUMN public.internal_events.estimated_attendance IS
  'Optional headcount estimate for open-public events.';

CREATE INDEX IF NOT EXISTS internal_events_org_coordinator_idx
  ON public.internal_events(organization_id, coordinator_contact_id)
  WHERE coordinator_contact_id IS NOT NULL;

-- Backfill workspace_features from legacy requires_* (only empty objects)
UPDATE public.internal_events
SET workspace_features = jsonb_strip_nulls(
  jsonb_build_object(
    'registration', COALESCE(requires_ticketing, false),
    'staff', COALESCE(requires_volunteers, false),
    'youth', COALESCE(requires_childcare, false),
    'vendors', COALESCE(requires_vendors, false),
    'finance', false,
    'waitlist', false
  )
)
WHERE workspace_features = '{}'::jsonb
   OR workspace_features IS NULL;

-- 2) Richer registration offering fields on event_ticket_types
ALTER TABLE public.event_ticket_types
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

ALTER TABLE public.event_ticket_types
  ADD COLUMN IF NOT EXISTS min_per_order INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.event_ticket_types
  ADD COLUMN IF NOT EXISTS max_per_order INTEGER;

ALTER TABLE public.event_ticket_types
  ADD COLUMN IF NOT EXISTS offering_kind TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_ticket_types_visibility_check'
  ) THEN
    ALTER TABLE public.event_ticket_types
      ADD CONSTRAINT event_ticket_types_visibility_check
      CHECK (visibility IN ('public', 'unlisted', 'private'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_ticket_types_offering_kind_check'
  ) THEN
    ALTER TABLE public.event_ticket_types
      ADD CONSTRAINT event_ticket_types_offering_kind_check
      CHECK (offering_kind IN ('standard', 'complimentary', 'youth_linked'));
  END IF;
END $$;

COMMENT ON COLUMN public.event_ticket_types.offering_kind IS
  'standard | complimentary | youth_linked — free/paid mix and youth checkout links.';

-- 3) Event expenses ledger
CREATE TABLE IF NOT EXISTS public.event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  internal_event_id UUID NOT NULL REFERENCES public.internal_events(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Other',
  payee TEXT,
  description TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_expenses_org_event_idx
  ON public.event_expenses(organization_id, internal_event_id, expense_date DESC);

ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage event expenses" ON public.event_expenses;
CREATE POLICY "Org members manage event expenses"
  ON public.event_expenses FOR ALL
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

DROP TRIGGER IF EXISTS event_expenses_updated_at ON public.event_expenses;
CREATE TRIGGER event_expenses_updated_at
  BEFORE UPDATE ON public.event_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

NOTIFY pgrst, 'reload schema';
