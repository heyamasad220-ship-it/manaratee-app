-- Pilot blocker B4: align headline "money received" totals (exclude voided payments)
-- Run after 119_donations_pilot_blocker_views.sql
--
-- Definition: money received = SUM(payments.amount) WHERE status IS NOT voided
-- Matches campaign metrics RPC and pledge_status_view payment inclusion rules.

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
  WHERE organization_id = p_org_id
    AND LOWER(COALESCE(status, '')) <> 'voided';
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
    AND LOWER(COALESCE(status, '')) <> 'voided'
    AND payment_date >= date_trunc('month', CURRENT_DATE) - ((p_months - 1) || ' months')::interval
  GROUP BY 1
  ORDER BY 1;
$$;

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
    AND LOWER(COALESCE(status, '')) <> 'voided'
    AND (p_date_from IS NULL OR payment_date >= p_date_from)
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.donation_org_reports_overview(p_org_id uuid)
RETURNS TABLE (
  total_donations numeric,
  payment_count bigint,
  average_donation numeric,
  donor_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH valid_payments AS (
    SELECT amount
    FROM public.payments
    WHERE organization_id = p_org_id
      AND LOWER(COALESCE(status, '')) <> 'voided'
  )
  SELECT
    COALESCE((SELECT SUM(amount) FROM valid_payments), 0),
    (SELECT COUNT(*)::bigint FROM valid_payments),
    CASE
      WHEN (SELECT COUNT(*) FROM valid_payments) > 0 THEN
        (SELECT SUM(amount) FROM valid_payments)
        / (SELECT COUNT(*) FROM valid_payments)
      ELSE 0
    END,
    (SELECT COUNT(*)::bigint FROM public.donor_summary_view WHERE organization_id = p_org_id);
$$;

COMMENT ON FUNCTION public.donation_org_payment_summary IS
  'Org-wide payment totals for donations dashboard (excludes voided payments).';

COMMENT ON FUNCTION public.donation_monthly_payment_totals IS
  'Monthly payment rollups for donations dashboard charts (excludes voided).';

COMMENT ON FUNCTION public.donation_payment_source_totals IS
  'Payment totals by source channel for dashboard pie chart (excludes voided).';

COMMENT ON FUNCTION public.donation_org_reports_overview IS
  'Reports overview totals (excludes voided payments; aligned with dashboard money received).';
