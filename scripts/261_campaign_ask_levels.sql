-- Campaign strategy ask levels (gift chart).
-- Backward-compatible. Safe to re-run.
-- Run after scripts/260_campaign_phases.sql.

CREATE TABLE IF NOT EXISTS public.campaign_ask_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  campaign_phase_id uuid REFERENCES public.campaign_phases(id) ON DELETE SET NULL,
  ask_amount numeric(14, 2) NOT NULL,
  target_count integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_ask_levels_ask_amount_positive CHECK (ask_amount > 0),
  CONSTRAINT campaign_ask_levels_target_count_nonneg CHECK (target_count >= 0)
);

CREATE INDEX IF NOT EXISTS campaign_ask_levels_org_campaign_idx
  ON public.campaign_ask_levels (organization_id, campaign_id, sort_order);

CREATE INDEX IF NOT EXISTS campaign_ask_levels_phase_idx
  ON public.campaign_ask_levels (campaign_phase_id)
  WHERE campaign_phase_id IS NOT NULL;

COMMENT ON TABLE public.campaign_ask_levels IS
  'Campaign strategy gift/ask chart rows (ask amount × target count). Prospects may exceed target_count.';

DROP TRIGGER IF EXISTS campaign_ask_levels_updated_at ON public.campaign_ask_levels;
CREATE TRIGGER campaign_ask_levels_updated_at
  BEFORE UPDATE ON public.campaign_ask_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.campaign_ask_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaign ask levels" ON public.campaign_ask_levels;
DROP POLICY IF EXISTS "Staff insert org campaign ask levels" ON public.campaign_ask_levels;
DROP POLICY IF EXISTS "Staff update org campaign ask levels" ON public.campaign_ask_levels;
DROP POLICY IF EXISTS "Staff delete org campaign ask levels" ON public.campaign_ask_levels;

CREATE POLICY "Staff view org campaign ask levels"
  ON public.campaign_ask_levels FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org campaign ask levels"
  ON public.campaign_ask_levels FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaign ask levels"
  ON public.campaign_ask_levels FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaign ask levels"
  ON public.campaign_ask_levels FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- Optional link from pledges to strategy ask level (prospect conversion / reporting).
ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS ask_level_id uuid REFERENCES public.campaign_ask_levels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pledges_ask_level_id_idx
  ON public.pledges (ask_level_id)
  WHERE ask_level_id IS NOT NULL;

COMMENT ON COLUMN public.pledges.ask_level_id IS
  'Optional campaign strategy ask level this pledge secured against.';
