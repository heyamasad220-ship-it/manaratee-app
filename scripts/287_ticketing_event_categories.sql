-- Ticketing event categories: org-managed labels (Kids Workshop, I Pray Party,
-- Bazaar, …) and optional assignment on ticketed internal events.
-- Backward-compatible. Safe to re-run.
-- Run after scripts/286_ticket_attendee_email_belongs_to_purchaser.sql.

CREATE TABLE IF NOT EXISTS public.ticketing_event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS ticketing_event_categories_org_active_idx
  ON public.ticketing_event_categories (organization_id, is_active, sort_order);

COMMENT ON TABLE public.ticketing_event_categories IS
  'Staff-managed Ticketing categories for grouping ticketed events (Kids Workshop, I Pray Party, Bazaar, …). Separate from event_types.';

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS ticketing_category_id uuid
  REFERENCES public.ticketing_event_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS internal_events_ticketing_category_idx
  ON public.internal_events (organization_id, ticketing_category_id)
  WHERE ticketing_category_id IS NOT NULL;

COMMENT ON COLUMN public.internal_events.ticketing_category_id IS
  'Optional Ticketing Events category. Null = Uncategorized. ON DELETE SET NULL.';

ALTER TABLE public.ticketing_event_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage ticketing event categories"
  ON public.ticketing_event_categories;
CREATE POLICY "Org members manage ticketing event categories"
  ON public.ticketing_event_categories FOR ALL
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

DROP TRIGGER IF EXISTS ticketing_event_categories_updated_at
  ON public.ticketing_event_categories;
CREATE TRIGGER ticketing_event_categories_updated_at
  BEFORE UPDATE ON public.ticketing_event_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Seed common categories for orgs that already sell tickets.
INSERT INTO public.ticketing_event_categories (
  organization_id, name, slug, sort_order
)
SELECT DISTINCT
  e.organization_id,
  seed.name,
  seed.slug,
  seed.sort_order
FROM public.internal_events e
CROSS JOIN (
  VALUES
    ('Kids Workshop', 'kids-workshop', 10),
    ('I Pray Party', 'i-pray-party', 20),
    ('Bazaar', 'bazaar', 30),
    ('Fundraising Dinner', 'fundraising-dinner', 40),
    ('Iftar', 'iftar', 50),
    ('Eid', 'eid', 60),
    ('Quran Competition', 'quran-competition', 70),
    ('Camp', 'camp', 80),
    ('Hajj', 'hajj', 90)
) AS seed(name, slug, sort_order)
WHERE e.requires_ticketing = true
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Assign uncategorized ticketed events from name patterns (specific first).
UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'kids-workshop'
  AND e.name ILIKE '%kids workshop%';

UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'i-pray-party'
  AND (
    e.name ILIKE '%i pray%'
    OR e.name ILIKE '%i-pray%'
    OR e.name ILIKE '%ipray%'
  );

UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'bazaar'
  AND e.name ILIKE '%bazaar%';

UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'quran-competition'
  AND (
    e.name ILIKE '%quraan competition%'
    OR e.name ILIKE '%quran competition%'
    OR e.name ILIKE '%qur''an competition%'
  );

UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'fundraising-dinner'
  AND (
    e.name ILIKE '%fundraising dinner%'
    OR e.name ILIKE '%fundraising gala%'
    OR e.name ILIKE '%fundraiser%'
  );

UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'iftar'
  AND e.name ILIKE '%iftar%';

UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'hajj'
  AND e.name ILIKE '%hajj%';

UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'eid'
  AND e.name ILIKE '%eid%';

UPDATE public.internal_events e
SET ticketing_category_id = c.id
FROM public.ticketing_event_categories c
WHERE e.ticketing_category_id IS NULL
  AND e.requires_ticketing = true
  AND c.organization_id = e.organization_id
  AND c.slug = 'camp'
  AND e.name ILIKE '%camp%';

NOTIFY pgrst, 'reload schema';
