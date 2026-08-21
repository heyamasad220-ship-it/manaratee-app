-- Campaign-scoped fundraising groups + ledger attribution.
-- Backward-compatible. Safe to re-run.
-- Run after scripts/262_campaign_prospects.sql.

CREATE TABLE IF NOT EXISTS public.campaign_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  organizational_group_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  lead_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  goal_amount numeric(14, 2),
  description text,
  public_token text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  public_progress_enabled boolean NOT NULL DEFAULT false,
  link_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_groups_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT campaign_groups_status_check CHECK (
    lower(status) IN ('active', 'paused', 'completed', 'archived')
  ),
  CONSTRAINT campaign_groups_public_token_unique UNIQUE (public_token)
);

CREATE INDEX IF NOT EXISTS campaign_groups_org_campaign_idx
  ON public.campaign_groups (organization_id, campaign_id, status);

CREATE INDEX IF NOT EXISTS campaign_groups_org_group_idx
  ON public.campaign_groups (organizational_group_id)
  WHERE organizational_group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_groups_campaign_name_unique
  ON public.campaign_groups (campaign_id, lower(trim(name)));

COMMENT ON TABLE public.campaign_groups IS
  'Campaign-specific fundraising groups/teams. Optional link to an org group contact. Group goals are tracking sub-goals only.';

DROP TRIGGER IF EXISTS campaign_groups_updated_at ON public.campaign_groups;
CREATE TRIGGER campaign_groups_updated_at
  BEFORE UPDATE ON public.campaign_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.campaign_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaign groups" ON public.campaign_groups;
DROP POLICY IF EXISTS "Staff insert org campaign groups" ON public.campaign_groups;
DROP POLICY IF EXISTS "Staff update org campaign groups" ON public.campaign_groups;
DROP POLICY IF EXISTS "Staff delete org campaign groups" ON public.campaign_groups;

CREATE POLICY "Staff view org campaign groups"
  ON public.campaign_groups FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org campaign groups"
  ON public.campaign_groups FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaign groups"
  ON public.campaign_groups FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaign groups"
  ON public.campaign_groups FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- Public donate pages resolve by token via service role (no anon SELECT of all groups).

ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS campaign_group_id uuid
    REFERENCES public.campaign_groups(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS campaign_group_id uuid
    REFERENCES public.campaign_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pledges_campaign_group_id_idx
  ON public.pledges (campaign_group_id)
  WHERE campaign_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_campaign_group_id_idx
  ON public.payments (campaign_group_id)
  WHERE campaign_group_id IS NOT NULL;

COMMENT ON COLUMN public.pledges.campaign_group_id IS
  'Optional campaign fundraising group attribution for this pledge.';

COMMENT ON COLUMN public.payments.campaign_group_id IS
  'Optional campaign fundraising group attribution for this payment.';
