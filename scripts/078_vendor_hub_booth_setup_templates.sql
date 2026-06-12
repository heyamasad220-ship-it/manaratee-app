-- Booth setup template library (org-scoped blueprints for recurring bazaars)
-- Run in Supabase SQL Editor after 077_vendor_hub_booth_attributes.sql

CREATE TABLE IF NOT EXISTS public.vendor_hub_booth_setup_templates (
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

CREATE INDEX IF NOT EXISTS vendor_hub_booth_setup_templates_org_active_idx
  ON public.vendor_hub_booth_setup_templates(organization_id, is_active, sort_order);

ALTER TABLE public.vendor_hub_booth_setup_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage booth setup templates" ON public.vendor_hub_booth_setup_templates;
CREATE POLICY "Org members manage booth setup templates"
  ON public.vendor_hub_booth_setup_templates FOR ALL
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

DROP TRIGGER IF EXISTS vendor_hub_booth_setup_templates_updated_at ON public.vendor_hub_booth_setup_templates;
CREATE TRIGGER vendor_hub_booth_setup_templates_updated_at
  BEFORE UPDATE ON public.vendor_hub_booth_setup_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.vendor_hub_booth_setup_template_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.vendor_hub_booth_setup_templates(id) ON DELETE CASCADE,
  line_name TEXT NOT NULL,
  size TEXT,
  price NUMERIC(10, 2) DEFAULT 0,
  color TEXT DEFAULT '#2563eb',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  capacity INTEGER DEFAULT 0,
  location TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  attribute_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_hub_booth_setup_template_lines_template_idx
  ON public.vendor_hub_booth_setup_template_lines(template_id, sort_order);

ALTER TABLE public.vendor_hub_booth_setup_template_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage booth setup template lines" ON public.vendor_hub_booth_setup_template_lines;
CREATE POLICY "Org members manage booth setup template lines"
  ON public.vendor_hub_booth_setup_template_lines FOR ALL
  USING (
    template_id IN (
      SELECT id FROM public.vendor_hub_booth_setup_templates
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM public.vendor_hub_booth_setup_templates
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

DROP TRIGGER IF EXISTS vendor_hub_booth_setup_template_lines_updated_at ON public.vendor_hub_booth_setup_template_lines;
CREATE TRIGGER vendor_hub_booth_setup_template_lines_updated_at
  BEFORE UPDATE ON public.vendor_hub_booth_setup_template_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.vendor_hub_booth_setup_templates IS
  'Reusable booth layout blueprints. Applying a template copies lines into event-scoped booth types and booths.';

COMMENT ON COLUMN public.vendor_hub_booth_setup_template_lines.attribute_slugs IS
  'JSON array of vendor_hub_booth_attributes.slug values to attach when the template is applied.';
