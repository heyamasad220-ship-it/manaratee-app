-- Payment refunds: net amounts in views/RPCs, pledge refresh on refunded_amount
-- Run after 124_donor_summary_outstanding_pledge.sql
--
-- Money received = SUM(amount - refunded_amount) for non-voided payments with net > 0.

CREATE OR REPLACE FUNCTION public.payment_net_amount(
  p_amount numeric,
  p_refunded_amount numeric DEFAULT 0
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(COALESCE(p_amount, 0) - COALESCE(p_refunded_amount, 0), 0::numeric);
$$;

COMMENT ON FUNCTION public.payment_net_amount(numeric, numeric) IS
  'Effective payment amount after refunds (never negative).';

-- ---------------------------------------------------------------------------
-- Pledge status + donor summary views
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.donor_summary_view;
DROP VIEW IF EXISTS public.pledge_status_view;

CREATE VIEW public.pledge_status_view
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.organization_id,
  p.donor_id,
  d.full_name AS donor_name,
  p.campaign_id,
  c.name AS campaign_name,
  p.amount_pledged,
  COALESCE(
    SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
    0::numeric
  ) AS amount_paid,
  CASE
    WHEN LOWER(COALESCE(p.status, '')) = 'cancelled' THEN 0::numeric
    ELSE GREATEST(
      p.amount_pledged - COALESCE(
        SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
        0::numeric
      ),
      0::numeric
    )
  END AS balance_remaining,
  p.pledge_date,
  p.pledge_type,
  p.frequency,
  CASE
    WHEN LOWER(COALESCE(p.status, '')) = 'cancelled' THEN 'cancelled'::text
    WHEN COALESCE(
      SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
      0::numeric
    ) >= p.amount_pledged THEN 'fulfilled'::text
    WHEN COALESCE(
      SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
      0::numeric
    ) > 0::numeric THEN 'partial'::text
    ELSE 'open'::text
  END AS calculated_status,
  p.status,
  p.notes,
  p.created_at
FROM public.pledges p
LEFT JOIN public.donors d ON d.id = p.donor_id
LEFT JOIN public.campaigns c ON c.id = p.campaign_id
LEFT JOIN public.payments pay
  ON pay.pledge_id = p.id
 AND LOWER(COALESCE(pay.status, '')) <> 'voided'
GROUP BY p.id, d.full_name, c.name;

CREATE VIEW public.donor_summary_view
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.organization_id,
  d.contact_id,
  d.donor_type,
  d.full_name,
  d.email,
  d.phone,
  d.status,
  d.created_at,
  COUNT(DISTINCT p.id) FILTER (
    WHERE public.payment_net_amount(p.amount, p.refunded_amount) > 0::numeric
  ) AS donation_count,
  COALESCE(
    SUM(public.payment_net_amount(p.amount, p.refunded_amount)),
    0::numeric
  ) AS total_donations,
  MAX(p.payment_date) FILTER (
    WHERE public.payment_net_amount(p.amount, p.refunded_amount) > 0::numeric
  ) AS last_donation_date,
  (
    EXISTS (
      SELECT 1
      FROM public.pledge_status_view psv
      WHERE psv.donor_id = d.id
        AND psv.balance_remaining > 0::numeric
    )
  ) AS has_open_pledge
FROM public.donors d
LEFT JOIN public.payments p
  ON p.donor_id = d.id
 AND LOWER(COALESCE(p.status, '')) <> 'voided'
GROUP BY d.id;

COMMENT ON VIEW public.pledge_status_view IS
  'Pledge balances from net non-voided payment amounts (amount - refunded_amount). security_invoker.';

COMMENT ON VIEW public.donor_summary_view IS
  'Donor giving summary from net non-voided payments. has_open_pledge from pledge_status_view. security_invoker.';

-- ---------------------------------------------------------------------------
-- Pledge status refresh (net amounts + refunded_amount trigger)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_pledge_status(p_pledge_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.pledges pl
  SET status = calc.new_status
  FROM (
    SELECT
      p.id,
      CASE
        WHEN LOWER(COALESCE(p.status, '')) = 'cancelled' THEN 'cancelled'
        WHEN COALESCE(
          SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
          0::numeric
        ) >= p.amount_pledged THEN 'fulfilled'
        WHEN COALESCE(
          SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
          0::numeric
        ) > 0::numeric THEN 'partial'
        ELSE 'open'
      END AS new_status
    FROM public.pledges p
    LEFT JOIN public.payments pay
      ON pay.pledge_id = p.id
     AND LOWER(COALESCE(pay.status, '')) <> 'voided'
    WHERE p.id = p_pledge_id
    GROUP BY p.id, p.amount_pledged, p.status
  ) calc
  WHERE pl.id = calc.id
    AND pl.status IS DISTINCT FROM calc.new_status;
$$;

DROP TRIGGER IF EXISTS sync_pledge_status_after_payment_change ON public.payments;

CREATE TRIGGER sync_pledge_status_after_payment_change
  AFTER INSERT OR UPDATE OF pledge_id, amount, status, refunded_amount OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pledge_status_on_payment_change();

-- ---------------------------------------------------------------------------
-- Dashboard / reports RPCs (net amounts)
-- ---------------------------------------------------------------------------

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
    COALESCE(SUM(public.payment_net_amount(amount, refunded_amount)), 0),
    COUNT(*) FILTER (
      WHERE public.payment_net_amount(amount, refunded_amount) > 0
    )::bigint,
    COALESCE(
      SUM(public.payment_net_amount(amount, refunded_amount)) FILTER (
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
    COALESCE(SUM(public.payment_net_amount(amount, refunded_amount)), 0),
    COUNT(*) FILTER (
      WHERE public.payment_net_amount(amount, refunded_amount) > 0
    )::bigint
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
    COALESCE(SUM(public.payment_net_amount(amount, refunded_amount)), 0)
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
    SELECT public.payment_net_amount(amount, refunded_amount) AS net_amount
    FROM public.payments
    WHERE organization_id = p_org_id
      AND LOWER(COALESCE(status, '')) <> 'voided'
      AND public.payment_net_amount(amount, refunded_amount) > 0
  )
  SELECT
    COALESCE((SELECT SUM(net_amount) FROM valid_payments), 0),
    (SELECT COUNT(*)::bigint FROM valid_payments),
    CASE
      WHEN (SELECT COUNT(*) FROM valid_payments) > 0 THEN
        (SELECT SUM(net_amount) FROM valid_payments)
        / (SELECT COUNT(*) FROM valid_payments)
      ELSE 0
    END,
    (SELECT COUNT(*)::bigint FROM public.donor_summary_view WHERE organization_id = p_org_id);
$$;

CREATE OR REPLACE FUNCTION public.donation_donor_tax_year_totals(
  p_org_id uuid,
  p_tax_year integer
)
RETURNS TABLE (
  donor_id uuid,
  donor_name text,
  donor_email text,
  total_amount numeric,
  payment_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pay.donor_id,
    COALESCE(MAX(d.full_name), MAX(pay.sender_name), 'Unknown') AS donor_name,
    MAX(d.email) AS donor_email,
    COALESCE(SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)), 0) AS total_amount,
    COUNT(*) FILTER (
      WHERE public.payment_net_amount(pay.amount, pay.refunded_amount) > 0
    )::bigint AS payment_count
  FROM public.payments pay
  LEFT JOIN public.donors d ON d.id = pay.donor_id
  WHERE pay.organization_id = p_org_id
    AND pay.donor_id IS NOT NULL
    AND pay.payment_date IS NOT NULL
    AND EXTRACT(YEAR FROM pay.payment_date)::integer = p_tax_year
    AND LOWER(COALESCE(pay.status, '')) <> 'voided'
  GROUP BY pay.donor_id
  HAVING COALESCE(SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)), 0) > 0
  ORDER BY total_amount DESC;
$$;
