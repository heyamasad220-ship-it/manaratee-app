-- Venues / spaces management foundation for Bookings > Settings > Spaces
-- Safe to re-run. Run after 044_sidebar_bookings_module.sql

CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  capacity INTEGER NOT NULL DEFAULT 0,
  base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  hourly_rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 0;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS base_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Legacy column used by older customer pages
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS max_capacity INTEGER;

UPDATE public.venues
SET capacity = COALESCE(capacity, max_capacity, 0)
WHERE capacity IS NULL OR capacity = 0;

CREATE INDEX IF NOT EXISTS venues_org_status_idx
  ON public.venues(organization_id, status);

CREATE INDEX IF NOT EXISTS venues_org_name_idx
  ON public.venues(organization_id, name);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage venues" ON public.venues;
CREATE POLICY "Org members manage venues"
  ON public.venues FOR ALL
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

DROP TRIGGER IF EXISTS venues_updated_at ON public.venues;
CREATE TRIGGER venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
