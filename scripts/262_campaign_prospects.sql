-- Campaign prospects (pre-pledge pipeline).
-- Backward-compatible. Safe to re-run.
-- Run after scripts/261_campaign_ask_levels.sql.

CREATE TABLE IF NOT EXISTS public.campaign_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  ask_level_id uuid REFERENCES public.campaign_ask_levels(id) ON DELETE SET NULL,
  suggested_ask_amount numeric(14, 2),
  assigned_to_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'identified',
  priority text NOT NULL DEFAULT 'medium',
  last_contacted_at date,
  next_follow_up_at date,
  notes text,
  converted_pledge_id uuid REFERENCES public.pledges(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_prospects_stage_check CHECK (
    lower(stage) IN (
      'identified',
      'assigned',
      'contacted',
      'meeting_scheduled',
      'asked',
      'pledged',
      'declined',
      'no_response'
    )
  ),
  CONSTRAINT campaign_prospects_priority_check CHECK (
    lower(priority) IN ('high', 'medium', 'low')
  ),
  CONSTRAINT campaign_prospects_unique_contact_per_campaign
    UNIQUE (campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS campaign_prospects_org_campaign_idx
  ON public.campaign_prospects (organization_id, campaign_id, stage);

CREATE INDEX IF NOT EXISTS campaign_prospects_assigned_idx
  ON public.campaign_prospects (organization_id, assigned_to_contact_id)
  WHERE assigned_to_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_prospects_ask_level_idx
  ON public.campaign_prospects (ask_level_id)
  WHERE ask_level_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_prospects_follow_up_idx
  ON public.campaign_prospects (organization_id, campaign_id, next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;

COMMENT ON TABLE public.campaign_prospects IS
  'Pre-pledge solicitation pipeline for a campaign. Links to contacts; does not create pledges until conversion.';

DROP TRIGGER IF EXISTS campaign_prospects_updated_at ON public.campaign_prospects;
CREATE TRIGGER campaign_prospects_updated_at
  BEFORE UPDATE ON public.campaign_prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.campaign_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaign prospects" ON public.campaign_prospects;
DROP POLICY IF EXISTS "Staff insert org campaign prospects" ON public.campaign_prospects;
DROP POLICY IF EXISTS "Staff update org campaign prospects" ON public.campaign_prospects;
DROP POLICY IF EXISTS "Staff delete org campaign prospects" ON public.campaign_prospects;

CREATE POLICY "Staff view org campaign prospects"
  ON public.campaign_prospects FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org campaign prospects"
  ON public.campaign_prospects FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaign prospects"
  ON public.campaign_prospects FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaign prospects"
  ON public.campaign_prospects FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- Optional reverse link for reporting (prospect that produced this pledge).
ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS campaign_prospect_id uuid
    REFERENCES public.campaign_prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pledges_campaign_prospect_id_idx
  ON public.pledges (campaign_prospect_id)
  WHERE campaign_prospect_id IS NOT NULL;

COMMENT ON COLUMN public.pledges.campaign_prospect_id IS
  'Optional prospect that converted into this pledge (one pledge record).';
