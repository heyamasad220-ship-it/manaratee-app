-- Donations dashboard summary RPCs (run after 097_donations_views.sql).

CREATE OR REPLACE FUNCTION public.donation_org_payment_summary(p_org_id uuid)
RETURNS TABLE (
  total_collected numeric,
  payment_count bigint,
  this_month_collected numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)::bigint,
    COALESCE(
      SUM(amount) FILTER (
        WHERE payment_date >= date_trunc('month', CURRENT_DATE)
          AND payment_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
      ),
      0
    )
  FROM public.payments
  WHERE organization_id = p_org_id;
$$;

CREATE OR REPLACE FUNCTION public.donation_org_pledge_summary(p_org_id uuid)
RETURNS TABLE (
  total_pledged numeric,
  total_collected numeric,
  outstanding_balance numeric,
  active_pledge_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount_pledged) FILTER (WHERE calculated_status <> 'cancelled'), 0),
    COALESCE(SUM(amount_paid) FILTER (WHERE calculated_status <> 'cancelled'), 0),
    COALESCE(SUM(GREATEST(balance_remaining, 0)) FILTER (WHERE calculated_status <> 'cancelled'), 0),
    COUNT(*) FILTER (WHERE calculated_status <> 'cancelled')::bigint
  FROM public.pledge_status_view
  WHERE organization_id = p_org_id;
$$;

CREATE OR REPLACE FUNCTION public.donation_monthly_payment_totals(
  p_org_id uuid,
  p_months integer DEFAULT 12
)
RETURNS TABLE (
  month_key text,
  amount numeric,
  payment_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(date_trunc('month', payment_date), 'YYYY-MM') AS month_key,
    COALESCE(SUM(amount), 0),
    COUNT(*)::bigint
  FROM public.payments
  WHERE organization_id = p_org_id
    AND payment_date >= date_trunc('month', CURRENT_DATE) - ((p_months - 1) || ' months')::interval
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.donation_org_payment_summary IS
  'Org-wide payment totals for donations dashboard (matches client sum semantics).';

COMMENT ON FUNCTION public.donation_org_pledge_summary IS
  'Org-wide pledge totals from pledge_status_view (excludes cancelled pledges).';

COMMENT ON FUNCTION public.donation_monthly_payment_totals IS
  'Monthly payment rollups for donations dashboard charts.';

CREATE OR REPLACE FUNCTION public.donation_payment_source_totals(
  p_org_id uuid,
  p_date_from timestamptz DEFAULT NULL
)
RETURNS TABLE (
  source_key text,
  amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(source), ''), 'other') AS source_key,
    COALESCE(SUM(amount), 0)
  FROM public.payments
  WHERE organization_id = p_org_id
    AND (p_date_from IS NULL OR payment_date >= p_date_from)
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.donation_payment_source_totals IS
  'Payment totals grouped by source channel for dashboard pie chart.';
