-- Donor giving report RPCs: date range, donor type, lapsed, outstanding pledge balance
-- Run after 126_donation_tax_year_totals_group_by_donor.sql

CREATE OR REPLACE FUNCTION public.donation_donor_giving_report(
  p_org_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_pledge_filter text DEFAULT 'all',
  p_donor_type text DEFAULT NULL,
  p_lapsed_only boolean DEFAULT false,
  p_sort_by text DEFAULT 'total_donations',
  p_sort_asc boolean DEFAULT false,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  donor_type text,
  total_donations numeric,
  donation_count bigint,
  last_donation_date date,
  lifetime_last_donation_date date,
  has_open_pledge boolean,
  outstanding_pledge_balance numeric,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lapsed_cutoff date := (CURRENT_DATE - INTERVAL '12 months')::date;
  v_search text := NULLIF(btrim(p_search), '');
BEGIN
  RETURN QUERY
  WITH filtered_payments AS (
    SELECT pay.id, pay.donor_id, pay.amount, pay.payment_date
    FROM public.payments pay
    WHERE pay.organization_id = p_org_id
      AND pay.donor_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
      AND (p_date_from IS NULL OR pay.payment_date >= p_date_from)
      AND (p_date_to IS NULL OR pay.payment_date <= p_date_to)
  ),
  lifetime_last AS (
    SELECT pay.donor_id, MAX(pay.payment_date) AS lifetime_last_donation_date
    FROM public.payments pay
    WHERE pay.organization_id = p_org_id
      AND pay.donor_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
    GROUP BY pay.donor_id
  ),
  pledge_balance AS (
    SELECT
      psv.donor_id,
      COALESCE(SUM(psv.balance_remaining), 0::numeric) AS outstanding_pledge_balance
    FROM public.pledge_status_view psv
    WHERE psv.organization_id = p_org_id
      AND psv.balance_remaining > 0::numeric
    GROUP BY psv.donor_id
  ),
  donor_rows AS (
    SELECT
      d.id,
      d.full_name,
      d.phone,
      d.donor_type,
      COUNT(DISTINCT fp.id)::bigint AS donation_count,
      COALESCE(SUM(fp.amount), 0::numeric) AS total_donations,
      MAX(fp.payment_date) AS last_donation_date,
      ll.lifetime_last_donation_date,
      COALESCE(pb.outstanding_pledge_balance, 0::numeric) AS outstanding_pledge_balance,
      (COALESCE(pb.outstanding_pledge_balance, 0::numeric) > 0::numeric) AS has_open_pledge
    FROM public.donors d
    LEFT JOIN filtered_payments fp ON fp.donor_id = d.id
    LEFT JOIN lifetime_last ll ON ll.donor_id = d.id
    LEFT JOIN pledge_balance pb ON pb.donor_id = d.id
    WHERE d.organization_id = p_org_id
    GROUP BY
      d.id,
      d.full_name,
      d.phone,
      d.donor_type,
      ll.lifetime_last_donation_date,
      pb.outstanding_pledge_balance
  ),
  filtered AS (
    SELECT dr.*
    FROM donor_rows dr
    WHERE
      (
        (p_date_from IS NULL AND p_date_to IS NULL)
        OR dr.donation_count > 0
      )
      AND (
        v_search IS NULL
        OR dr.full_name ILIKE '%' || v_search || '%'
        OR dr.phone ILIKE '%' || v_search || '%'
      )
      AND (p_donor_type IS NULL OR dr.donor_type = p_donor_type)
      AND (
        p_pledge_filter = 'all'
        OR (p_pledge_filter = 'open_pledge' AND dr.has_open_pledge)
        OR (p_pledge_filter = 'no_open_pledge' AND NOT dr.has_open_pledge)
      )
      AND (
        NOT p_lapsed_only
        OR dr.lifetime_last_donation_date IS NULL
        OR dr.lifetime_last_donation_date < v_lapsed_cutoff
      )
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER () AS total_count
    FROM filtered f
  )
  SELECT
    c.id,
    c.full_name,
    c.phone,
    c.donor_type,
    c.total_donations,
    c.donation_count,
    c.last_donation_date,
    c.lifetime_last_donation_date,
    c.has_open_pledge,
    c.outstanding_pledge_balance,
    c.total_count
  FROM counted c
  ORDER BY
    CASE WHEN p_sort_by = 'full_name' AND p_sort_asc THEN c.full_name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'full_name' AND NOT p_sort_asc THEN c.full_name END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_donation_date' AND p_sort_asc THEN c.last_donation_date END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_donation_date' AND NOT p_sort_asc THEN c.last_donation_date END DESC NULLS LAST,
    CASE
      WHEN p_sort_by = 'outstanding_pledge_balance' AND p_sort_asc THEN c.outstanding_pledge_balance
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_by = 'outstanding_pledge_balance' AND NOT p_sort_asc THEN c.outstanding_pledge_balance
    END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'total_donations' AND p_sort_asc THEN c.total_donations END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'total_donations' AND NOT p_sort_asc THEN c.total_donations END DESC NULLS LAST,
    c.full_name ASC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.donation_donor_giving_report_summary(
  p_org_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_pledge_filter text DEFAULT 'all',
  p_donor_type text DEFAULT NULL,
  p_lapsed_only boolean DEFAULT false
)
RETURNS TABLE (
  donor_count bigint,
  total_given numeric,
  gift_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lapsed_cutoff date := (CURRENT_DATE - INTERVAL '12 months')::date;
  v_search text := NULLIF(btrim(p_search), '');
BEGIN
  RETURN QUERY
  WITH filtered_payments AS (
    SELECT pay.id, pay.donor_id, pay.amount, pay.payment_date
    FROM public.payments pay
    WHERE pay.organization_id = p_org_id
      AND pay.donor_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
      AND (p_date_from IS NULL OR pay.payment_date >= p_date_from)
      AND (p_date_to IS NULL OR pay.payment_date <= p_date_to)
  ),
  lifetime_last AS (
    SELECT pay.donor_id, MAX(pay.payment_date) AS lifetime_last_donation_date
    FROM public.payments pay
    WHERE pay.organization_id = p_org_id
      AND pay.donor_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
    GROUP BY pay.donor_id
  ),
  pledge_balance AS (
    SELECT
      psv.donor_id,
      COALESCE(SUM(psv.balance_remaining), 0::numeric) AS outstanding_pledge_balance
    FROM public.pledge_status_view psv
    WHERE psv.organization_id = p_org_id
      AND psv.balance_remaining > 0::numeric
    GROUP BY psv.donor_id
  ),
  donor_rows AS (
    SELECT
      d.id,
      d.full_name,
      d.phone,
      d.donor_type,
      COUNT(DISTINCT fp.id)::bigint AS donation_count,
      COALESCE(SUM(fp.amount), 0::numeric) AS total_donations,
      ll.lifetime_last_donation_date,
      COALESCE(pb.outstanding_pledge_balance, 0::numeric) AS outstanding_pledge_balance,
      (COALESCE(pb.outstanding_pledge_balance, 0::numeric) > 0::numeric) AS has_open_pledge
    FROM public.donors d
    LEFT JOIN filtered_payments fp ON fp.donor_id = d.id
    LEFT JOIN lifetime_last ll ON ll.donor_id = d.id
    LEFT JOIN pledge_balance pb ON pb.donor_id = d.id
    WHERE d.organization_id = p_org_id
    GROUP BY
      d.id,
      d.full_name,
      d.phone,
      d.donor_type,
      ll.lifetime_last_donation_date,
      pb.outstanding_pledge_balance
  ),
  filtered AS (
    SELECT dr.*
    FROM donor_rows dr
    WHERE
      (
        (p_date_from IS NULL AND p_date_to IS NULL)
        OR dr.donation_count > 0
      )
      AND (
        v_search IS NULL
        OR dr.full_name ILIKE '%' || v_search || '%'
        OR dr.phone ILIKE '%' || v_search || '%'
      )
      AND (p_donor_type IS NULL OR dr.donor_type = p_donor_type)
      AND (
        p_pledge_filter = 'all'
        OR (p_pledge_filter = 'open_pledge' AND dr.has_open_pledge)
        OR (p_pledge_filter = 'no_open_pledge' AND NOT dr.has_open_pledge)
      )
      AND (
        NOT p_lapsed_only
        OR dr.lifetime_last_donation_date IS NULL
        OR dr.lifetime_last_donation_date < v_lapsed_cutoff
      )
  )
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(f.total_donations), 0::numeric),
    COALESCE(SUM(f.donation_count), 0::bigint)
  FROM filtered f;
END;
$$;

COMMENT ON FUNCTION public.donation_donor_giving_report IS
  'Paginated donor giving report with optional payment date range, donor type, lapsed-only, and pledge filters.';

COMMENT ON FUNCTION public.donation_donor_giving_report_summary IS
  'Aggregate donor count, total given, and gift count for donation_donor_giving_report filters.';
