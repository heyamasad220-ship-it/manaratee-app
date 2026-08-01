-- Venue rental discount policies (Settings → Discounts).
-- Optional catalog: fixed $ or % off space fee.
-- Conditions: multi-venue and/or contact discount tag.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.venue_rental_discount_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  requires_multi_venue BOOLEAN NOT NULL DEFAULT false,
  min_venues INTEGER NOT NULL DEFAULT 2 CHECK (min_venues >= 2),
  discount_tag_id UUID REFERENCES public.discount_tags(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT venue_rental_discount_policies_org_name_unique
    UNIQUE (organization_id, name),
  CONSTRAINT venue_rental_discount_policies_percent_range
    CHECK (discount_type <> 'percent' OR amount <= 100)
);

CREATE INDEX IF NOT EXISTS idx_venue_rental_discount_policies_org_active
  ON public.venue_rental_discount_policies (organization_id, is_active, sort_order);

COMMENT ON TABLE public.venue_rental_discount_policies IS
  'Optional Venue Rentals Settings discount rules (fixed or percent). Eligibility via multi-venue and/or Contacts discount tags.';

COMMENT ON COLUMN public.venue_rental_discount_policies.amount IS
  'Fixed dollar amount or percent off (0–100) depending on discount_type.';

COMMENT ON COLUMN public.venue_rental_discount_policies.requires_multi_venue IS
  'When true, rental must include at least min_venues spaces.';

COMMENT ON COLUMN public.venue_rental_discount_policies.discount_tag_id IS
  'When set, billing contact must have this Contacts discount tag.';

ALTER TABLE public.venue_rental_discount_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage venue rental discount policies"
  ON public.venue_rental_discount_policies;
CREATE POLICY "Org members manage venue rental discount policies"
  ON public.venue_rental_discount_policies FOR ALL
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

DROP TRIGGER IF EXISTS venue_rental_discount_policies_updated_at
  ON public.venue_rental_discount_policies;
CREATE TRIGGER venue_rental_discount_policies_updated_at
  BEFORE UPDATE ON public.venue_rental_discount_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
