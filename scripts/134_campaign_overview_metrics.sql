-- Per-campaign overview metric visibility and order on /donations/campaigns/[id].
-- null = auto (hide zero-value source rows; always show donors, largest gift, pledges).

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS overview_metric_keys jsonb;

COMMENT ON COLUMN public.campaigns.overview_metric_keys IS
  'Ordered JSON array of campaign overview metric keys (cash, checks, square, one-time, recurring, ticket-sales, other, donors, largest-gift, pledges). null = auto-hide empty source rows.';
