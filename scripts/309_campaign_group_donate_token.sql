-- One public donation link per campaign. Donors choose a campaign group on that page.
-- Per-group public_token values stay on campaign_groups for existing rows and are no longer used.
-- Safe to re-run.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS group_donate_token text;

UPDATE public.campaigns
SET group_donate_token = replace(gen_random_uuid()::text, '-', '')
WHERE group_donate_token IS NULL;

ALTER TABLE public.campaigns
  ALTER COLUMN group_donate_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

ALTER TABLE public.campaigns
  ALTER COLUMN group_donate_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_group_donate_token_key
  ON public.campaigns (group_donate_token);

COMMENT ON COLUMN public.campaigns.group_donate_token IS
  'Opaque token for the shared campaign group donation page /donate/g/{token}.';
