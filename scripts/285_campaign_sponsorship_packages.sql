-- Campaign-owned sponsorship packages (optional related event), package
-- benefit quantity/value, and per-sponsorship benefit snapshots + fulfillment.
-- Backward-compatible. Safe to re-run.
-- Run after scripts/284_campaign_sponsorship_prospects.sql.

-- ---------------------------------------------------------------------------
-- Packages belong to a campaign; event is optional
-- ---------------------------------------------------------------------------

ALTER TABLE public.sponsorship_packages
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.sponsorship_packages
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill campaign from a linked fundraising event, then from usage.
UPDATE public.sponsorship_packages pkg
SET campaign_id = linked.campaign_id::uuid
FROM (
  SELECT
    e.id AS event_id,
    e.organization_id,
    e.ticketing_config->>'linkedCampaignId' AS campaign_id
  FROM public.internal_events e
  WHERE e.ticketing_config->>'linkedCampaignId' IS NOT NULL
    AND btrim(e.ticketing_config->>'linkedCampaignId') <> ''
) AS linked
WHERE pkg.campaign_id IS NULL
  AND pkg.event_id = linked.event_id
  AND pkg.organization_id = linked.organization_id
  AND EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = linked.campaign_id::uuid
      AND c.organization_id = pkg.organization_id
  );

UPDATE public.sponsorship_packages pkg
SET campaign_id = src.campaign_id
FROM (
  SELECT DISTINCT ON (sponsorship_package_id)
    sponsorship_package_id,
    campaign_id,
    organization_id
  FROM public.campaign_sponsorships
  WHERE sponsorship_package_id IS NOT NULL
  ORDER BY sponsorship_package_id, created_at DESC
) AS src
WHERE pkg.campaign_id IS NULL
  AND pkg.id = src.sponsorship_package_id
  AND pkg.organization_id = src.organization_id;

UPDATE public.sponsorship_packages pkg
SET campaign_id = src.campaign_id
FROM (
  SELECT DISTINCT ON (sponsorship_package_id)
    sponsorship_package_id,
    campaign_id,
    organization_id
  FROM public.campaign_prospects
  WHERE sponsorship_package_id IS NOT NULL
  ORDER BY sponsorship_package_id, created_at DESC
) AS src
WHERE pkg.campaign_id IS NULL
  AND pkg.id = src.sponsorship_package_id
  AND pkg.organization_id = src.organization_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sponsorship_packages WHERE campaign_id IS NULL
  ) THEN
    ALTER TABLE public.sponsorship_packages
      ALTER COLUMN campaign_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.sponsorship_packages
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.sponsorship_packages
  DROP CONSTRAINT IF EXISTS sponsorship_packages_event_id_fkey;

ALTER TABLE public.sponsorship_packages
  ADD CONSTRAINT sponsorship_packages_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.internal_events(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS public.sponsorship_packages_org_event_idx;
DROP INDEX IF EXISTS public.sponsorship_packages_event_active_idx;

CREATE INDEX IF NOT EXISTS sponsorship_packages_org_campaign_idx
  ON public.sponsorship_packages (organization_id, campaign_id, display_order);

CREATE INDEX IF NOT EXISTS sponsorship_packages_campaign_active_idx
  ON public.sponsorship_packages (campaign_id, display_order)
  WHERE active = true;

COMMENT ON TABLE public.sponsorship_packages IS
  'Campaign sponsorship packages (name, amount, optional related event, benefits). Not a Contact classification.';

COMMENT ON COLUMN public.sponsorship_packages.campaign_id IS
  'Required owning campaign. Packages are not shared across campaigns.';

COMMENT ON COLUMN public.sponsorship_packages.event_id IS
  'Optional related fundraising event. Packages may exist without an event.';

-- ---------------------------------------------------------------------------
-- Package benefits: optional type + quantity/value text
-- ---------------------------------------------------------------------------

ALTER TABLE public.sponsorship_package_benefits
  ADD COLUMN IF NOT EXISTS benefit_type text;

ALTER TABLE public.sponsorship_package_benefits
  ADD COLUMN IF NOT EXISTS value text;

COMMENT ON COLUMN public.sponsorship_package_benefits.name IS
  'Benefit label shown to staff and copied onto committed sponsorships.';

COMMENT ON COLUMN public.sponsorship_package_benefits.value IS
  'Optional quantity or duration, e.g. 5 posts, 30 days, 6 seats.';

COMMENT ON COLUMN public.sponsorship_package_benefits.benefit_type IS
  'Optional category (stage, banner, seats, custom, …). Labels stay free-form.';

-- ---------------------------------------------------------------------------
-- Snapshot + fulfillment of promised benefits on a committed sponsorship
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_sponsorship_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sponsorship_id uuid NOT NULL REFERENCES public.campaign_sponsorships(id) ON DELETE CASCADE,
  package_benefit_id uuid REFERENCES public.sponsorship_package_benefits(id) ON DELETE SET NULL,
  name text NOT NULL,
  value text,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_sponsorship_benefits_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT campaign_sponsorship_benefits_status_check CHECK (
    lower(status) IN ('pending', 'in_progress', 'completed', 'not_applicable')
  )
);

CREATE INDEX IF NOT EXISTS campaign_sponsorship_benefits_sponsorship_idx
  ON public.campaign_sponsorship_benefits (organization_id, sponsorship_id, display_order);

COMMENT ON TABLE public.campaign_sponsorship_benefits IS
  'Copied package benefits for one committed sponsorship. Fulfillment lives here, not on the package.';

DROP TRIGGER IF EXISTS campaign_sponsorship_benefits_updated_at ON public.campaign_sponsorship_benefits;
CREATE TRIGGER campaign_sponsorship_benefits_updated_at
  BEFORE UPDATE ON public.campaign_sponsorship_benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.campaign_sponsorship_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaign sponsorship benefits" ON public.campaign_sponsorship_benefits;
DROP POLICY IF EXISTS "Staff insert org campaign sponsorship benefits" ON public.campaign_sponsorship_benefits;
DROP POLICY IF EXISTS "Staff update org campaign sponsorship benefits" ON public.campaign_sponsorship_benefits;
DROP POLICY IF EXISTS "Staff delete org campaign sponsorship benefits" ON public.campaign_sponsorship_benefits;

CREATE POLICY "Staff view org campaign sponsorship benefits"
  ON public.campaign_sponsorship_benefits FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org campaign sponsorship benefits"
  ON public.campaign_sponsorship_benefits FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaign sponsorship benefits"
  ON public.campaign_sponsorship_benefits FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaign sponsorship benefits"
  ON public.campaign_sponsorship_benefits FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));
