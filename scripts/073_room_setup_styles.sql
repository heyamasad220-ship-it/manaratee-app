-- Room / facility setup styles for internal events and venue rentals
-- Run in Supabase SQL Editor after 072_module_notification_settings.sql

CREATE TABLE IF NOT EXISTS public.room_setup_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS room_setup_styles_org_active_idx
  ON public.room_setup_styles(organization_id, is_active, sort_order);

ALTER TABLE public.room_setup_styles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage room setup styles" ON public.room_setup_styles;
CREATE POLICY "Org members manage room setup styles"
  ON public.room_setup_styles FOR ALL
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

DROP TRIGGER IF EXISTS room_setup_styles_updated_at ON public.room_setup_styles;
CREATE TRIGGER room_setup_styles_updated_at
  BEFORE UPDATE ON public.room_setup_styles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.room_setup_styles (organization_id, name, slug, sort_order)
SELECT o.id, v.name, v.slug, v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Theater Style', 'theater-style', 10),
    ('Classroom Style', 'classroom-style', 20),
    ('Banquet Style (Round Tables)', 'banquet-style-round-tables', 30),
    ('Reception Style', 'reception-style', 40),
    ('U-Shape', 'u-shape', 50),
    ('Boardroom Style', 'boardroom-style', 60),
    ('Hollow Square', 'hollow-square', 70),
    ('No Setup Required', 'no-setup-required', 80),
    ('Custom (describe in notes)', 'custom-describe-in-notes', 90)
) AS v(name, slug, sort_order)
ON CONFLICT (organization_id, slug) DO NOTHING;
