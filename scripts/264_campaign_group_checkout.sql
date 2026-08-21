-- Campaign group attribution on Stripe donation checkout sessions.
-- Backward-compatible. Safe to re-run.
-- Run after scripts/263_campaign_groups.sql.

ALTER TABLE public.donation_checkout_sessions
  ADD COLUMN IF NOT EXISTS campaign_group_id uuid
    REFERENCES public.campaign_groups(id) ON DELETE SET NULL;

ALTER TABLE public.donation_checkout_sessions
  ADD COLUMN IF NOT EXISTS attributed_group_contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS donation_checkout_sessions_campaign_group_idx
  ON public.donation_checkout_sessions (campaign_group_id)
  WHERE campaign_group_id IS NOT NULL;

COMMENT ON COLUMN public.donation_checkout_sessions.campaign_group_id IS
  'Campaign fundraising group for public/group donation links.';

COMMENT ON COLUMN public.donation_checkout_sessions.attributed_group_contact_id IS
  'Optional org group contact for Group Giving rollups when the campaign group is linked.';
