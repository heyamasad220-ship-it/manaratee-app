-- Unified campaign prospects: donation + sponsorship ask types, outreach
-- activity history, event sponsorship packages, and committed sponsorships.
-- Backward-compatible. Safe to re-run.
-- Existing campaign_prospects rows default to ask_type = donation.
-- Run after scripts/262_campaign_prospects.sql.

-- ---------------------------------------------------------------------------
-- Sponsorship packages (belong to an event, not to a Contact)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sponsorship_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.internal_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsorship_packages_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT sponsorship_packages_amount_non_negative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS sponsorship_packages_org_event_idx
  ON public.sponsorship_packages (organization_id, event_id, display_order);

CREATE INDEX IF NOT EXISTS sponsorship_packages_event_active_idx
  ON public.sponsorship_packages (event_id, display_order)
  WHERE active = true;

COMMENT ON TABLE public.sponsorship_packages IS
  'Event sponsorship packages (name, amount, benefits). Not a Contact classification.';

DROP TRIGGER IF EXISTS sponsorship_packages_updated_at ON public.sponsorship_packages;
CREATE TRIGGER sponsorship_packages_updated_at
  BEFORE UPDATE ON public.sponsorship_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.sponsorship_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org sponsorship packages" ON public.sponsorship_packages;
DROP POLICY IF EXISTS "Staff insert org sponsorship packages" ON public.sponsorship_packages;
DROP POLICY IF EXISTS "Staff update org sponsorship packages" ON public.sponsorship_packages;
DROP POLICY IF EXISTS "Staff delete org sponsorship packages" ON public.sponsorship_packages;

CREATE POLICY "Staff view org sponsorship packages"
  ON public.sponsorship_packages FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org sponsorship packages"
  ON public.sponsorship_packages FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org sponsorship packages"
  ON public.sponsorship_packages FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org sponsorship packages"
  ON public.sponsorship_packages FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- Package benefits (fulfillment tracking can be added on committed sponsorships later)
CREATE TABLE IF NOT EXISTS public.sponsorship_package_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.sponsorship_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsorship_package_benefits_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS sponsorship_package_benefits_package_idx
  ON public.sponsorship_package_benefits (organization_id, package_id, display_order);

COMMENT ON TABLE public.sponsorship_package_benefits IS
  'Benefits included in a sponsorship package. Fulfillment is tracked on committed sponsorships, not prospects.';

DROP TRIGGER IF EXISTS sponsorship_package_benefits_updated_at ON public.sponsorship_package_benefits;
CREATE TRIGGER sponsorship_package_benefits_updated_at
  BEFORE UPDATE ON public.sponsorship_package_benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.sponsorship_package_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org sponsorship package benefits" ON public.sponsorship_package_benefits;
DROP POLICY IF EXISTS "Staff insert org sponsorship package benefits" ON public.sponsorship_package_benefits;
DROP POLICY IF EXISTS "Staff update org sponsorship package benefits" ON public.sponsorship_package_benefits;
DROP POLICY IF EXISTS "Staff delete org sponsorship package benefits" ON public.sponsorship_package_benefits;

CREATE POLICY "Staff view org sponsorship package benefits"
  ON public.sponsorship_package_benefits FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org sponsorship package benefits"
  ON public.sponsorship_package_benefits FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org sponsorship package benefits"
  ON public.sponsorship_package_benefits FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org sponsorship package benefits"
  ON public.sponsorship_package_benefits FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- ---------------------------------------------------------------------------
-- Campaign prospect columns (ask type + optional sponsorship context)
-- ---------------------------------------------------------------------------

ALTER TABLE public.campaign_prospects
  ADD COLUMN IF NOT EXISTS ask_type text NOT NULL DEFAULT 'donation';

ALTER TABLE public.campaign_prospects
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.internal_events(id) ON DELETE SET NULL;

ALTER TABLE public.campaign_prospects
  ADD COLUMN IF NOT EXISTS sponsorship_package_id uuid
    REFERENCES public.sponsorship_packages(id) ON DELETE SET NULL;

UPDATE public.campaign_prospects
SET ask_type = 'donation'
WHERE ask_type IS NULL OR btrim(ask_type) = '';

ALTER TABLE public.campaign_prospects
  DROP CONSTRAINT IF EXISTS campaign_prospects_ask_type_check;

ALTER TABLE public.campaign_prospects
  ADD CONSTRAINT campaign_prospects_ask_type_check
  CHECK (lower(ask_type) IN ('donation', 'sponsorship'));

-- Allow the same Contact as a donation prospect and a sponsorship prospect
-- in one campaign. Ask type lives on the prospect, not the Contact.
ALTER TABLE public.campaign_prospects
  DROP CONSTRAINT IF EXISTS campaign_prospects_unique_contact_per_campaign;

ALTER TABLE public.campaign_prospects
  DROP CONSTRAINT IF EXISTS campaign_prospects_unique_contact_ask_type;

ALTER TABLE public.campaign_prospects
  ADD CONSTRAINT campaign_prospects_unique_contact_ask_type
  UNIQUE (campaign_id, contact_id, ask_type);

CREATE INDEX IF NOT EXISTS campaign_prospects_ask_type_idx
  ON public.campaign_prospects (organization_id, campaign_id, ask_type);

CREATE INDEX IF NOT EXISTS campaign_prospects_event_idx
  ON public.campaign_prospects (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_prospects_package_idx
  ON public.campaign_prospects (sponsorship_package_id)
  WHERE sponsorship_package_id IS NOT NULL;

COMMENT ON COLUMN public.campaign_prospects.ask_type IS
  'Outreach ask for this campaign only: donation or sponsorship. Not a Contact role.';

COMMENT ON COLUMN public.campaign_prospects.event_id IS
  'Optional related fundraising event for a sponsorship ask.';

COMMENT ON COLUMN public.campaign_prospects.sponsorship_package_id IS
  'Optional package under discussion. Amount is stored separately on suggested_ask_amount.';

COMMENT ON TABLE public.campaign_prospects IS
  'Campaign outreach pipeline for donation and sponsorship prospects. Links to contacts; does not create pledges or sponsorships until conversion.';

-- ---------------------------------------------------------------------------
-- Prospect outreach activity history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_prospect_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.campaign_prospects(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'note',
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_prospect_activities_type_check CHECK (
    lower(activity_type) IN (
      'email',
      'phone_call',
      'meeting',
      'text',
      'follow_up',
      'note',
      'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS campaign_prospect_activities_prospect_idx
  ON public.campaign_prospect_activities (organization_id, prospect_id, activity_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS campaign_prospect_activities_campaign_idx
  ON public.campaign_prospect_activities (organization_id, campaign_id, activity_date DESC);

COMMENT ON TABLE public.campaign_prospect_activities IS
  'Outreach history for a campaign prospect. Email/phone/meeting/text/follow-up update last_contacted_at; notes do not.';

DROP TRIGGER IF EXISTS campaign_prospect_activities_updated_at ON public.campaign_prospect_activities;
CREATE TRIGGER campaign_prospect_activities_updated_at
  BEFORE UPDATE ON public.campaign_prospect_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.campaign_prospect_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaign prospect activities" ON public.campaign_prospect_activities;
DROP POLICY IF EXISTS "Staff insert org campaign prospect activities" ON public.campaign_prospect_activities;
DROP POLICY IF EXISTS "Staff update org campaign prospect activities" ON public.campaign_prospect_activities;
DROP POLICY IF EXISTS "Staff delete org campaign prospect activities" ON public.campaign_prospect_activities;

CREATE POLICY "Staff view org campaign prospect activities"
  ON public.campaign_prospect_activities FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org campaign prospect activities"
  ON public.campaign_prospect_activities FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaign prospect activities"
  ON public.campaign_prospect_activities FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaign prospect activities"
  ON public.campaign_prospect_activities FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- ---------------------------------------------------------------------------
-- Committed campaign sponsorships (post-conversion; not outreach)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.internal_events(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.campaign_prospects(id) ON DELETE SET NULL,
  sponsorship_package_id uuid REFERENCES public.sponsorship_packages(id) ON DELETE SET NULL,
  sponsorship_type text NOT NULL DEFAULT 'cash',
  committed_amount numeric(14, 2) NOT NULL DEFAULT 0,
  cash_amount numeric(14, 2) NOT NULL DEFAULT 0,
  in_kind_value numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'committed',
  payment_status text NOT NULL DEFAULT 'unpaid',
  committed_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_sponsorships_type_check CHECK (
    lower(sponsorship_type) IN ('cash', 'in_kind', 'mixed')
  ),
  CONSTRAINT campaign_sponsorships_status_check CHECK (
    lower(status) IN ('committed', 'confirmed', 'completed', 'cancelled')
  ),
  CONSTRAINT campaign_sponsorships_payment_status_check CHECK (
    lower(payment_status) IN ('unpaid', 'partial', 'paid', 'waived')
  ),
  CONSTRAINT campaign_sponsorships_amounts_non_negative CHECK (
    committed_amount >= 0 AND cash_amount >= 0 AND in_kind_value >= 0
  )
);

CREATE INDEX IF NOT EXISTS campaign_sponsorships_org_campaign_idx
  ON public.campaign_sponsorships (organization_id, campaign_id, status);

CREATE INDEX IF NOT EXISTS campaign_sponsorships_contact_idx
  ON public.campaign_sponsorships (organization_id, contact_id);

CREATE INDEX IF NOT EXISTS campaign_sponsorships_event_idx
  ON public.campaign_sponsorships (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_sponsorships_prospect_idx
  ON public.campaign_sponsorships (prospect_id)
  WHERE prospect_id IS NOT NULL;

COMMENT ON TABLE public.campaign_sponsorships IS
  'Committed event/campaign sponsorships. Separate from pledges and donations. Outreach stays on campaign_prospects.';

DROP TRIGGER IF EXISTS campaign_sponsorships_updated_at ON public.campaign_sponsorships;
CREATE TRIGGER campaign_sponsorships_updated_at
  BEFORE UPDATE ON public.campaign_sponsorships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.campaign_sponsorships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaign sponsorships" ON public.campaign_sponsorships;
DROP POLICY IF EXISTS "Staff insert org campaign sponsorships" ON public.campaign_sponsorships;
DROP POLICY IF EXISTS "Staff update org campaign sponsorships" ON public.campaign_sponsorships;
DROP POLICY IF EXISTS "Staff delete org campaign sponsorships" ON public.campaign_sponsorships;

CREATE POLICY "Staff view org campaign sponsorships"
  ON public.campaign_sponsorships FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org campaign sponsorships"
  ON public.campaign_sponsorships FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaign sponsorships"
  ON public.campaign_sponsorships FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaign sponsorships"
  ON public.campaign_sponsorships FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

ALTER TABLE public.campaign_prospects
  ADD COLUMN IF NOT EXISTS converted_sponsorship_id uuid
    REFERENCES public.campaign_sponsorships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_prospects_converted_sponsorship_idx
  ON public.campaign_prospects (converted_sponsorship_id)
  WHERE converted_sponsorship_id IS NOT NULL;

COMMENT ON COLUMN public.campaign_prospects.converted_sponsorship_id IS
  'Committed sponsorship created from this prospect. Suggested ask is preserved.';
