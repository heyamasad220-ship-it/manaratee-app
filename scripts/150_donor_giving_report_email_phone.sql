-- Donor + household giving reports: return email and phone columns for report tables.
-- Run after 149_household_giving_report.sql

DROP FUNCTION IF EXISTS public.donation_donor_giving_report(
  uuid,
  date,
  date,
  text,
  text,
  text,
  boolean,
  numeric,
  text,
  boolean,
  integer,
  integer
);

CREATE OR REPLACE FUNCTION public.donation_donor_giving_report(
  p_org_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_pledge_filter text DEFAULT 'all',
  p_donor_type text DEFAULT NULL,
  p_lapsed_only boolean DEFAULT false,
  p_min_total_given numeric DEFAULT NULL,
  p_sort_by text DEFAULT 'total_donations',
  p_sort_asc boolean DEFAULT false,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  contact_id uuid,
  full_name text,
  email text,
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
    SELECT
      pay.id,
      pay.donor_id,
      public.payment_net_amount(pay.amount, pay.refunded_amount) AS net_amount,
      pay.payment_date
    FROM public.payments pay
    WHERE pay.organization_id = p_org_id
      AND pay.donor_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
      AND public.payment_net_amount(pay.amount, pay.refunded_amount) > 0::numeric
      AND (p_date_from IS NULL OR pay.payment_date::date >= p_date_from)
      AND (p_date_to IS NULL OR pay.payment_date::date <= p_date_to)
  ),
  lifetime_last AS (
    SELECT
      pay.donor_id,
      MAX(pay.payment_date)::date AS lifetime_last_donation_date
    FROM public.payments pay
    WHERE pay.organization_id = p_org_id
      AND pay.donor_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
      AND public.payment_net_amount(pay.amount, pay.refunded_amount) > 0::numeric
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
      d.contact_id,
      d.full_name,
      NULLIF(
        btrim(COALESCE(d.email, c.email, '')),
        ''
      ) AS email,
      NULLIF(
        btrim(COALESCE(d.phone, c.phone, '')),
        ''
      ) AS phone,
      d.donor_type,
      COUNT(DISTINCT fp.id)::bigint AS donation_count,
      COALESCE(SUM(fp.net_amount), 0::numeric) AS total_donations,
      MAX(fp.payment_date)::date AS last_donation_date,
      ll.lifetime_last_donation_date,
      COALESCE(pb.outstanding_pledge_balance, 0::numeric) AS outstanding_pledge_balance,
      (COALESCE(pb.outstanding_pledge_balance, 0::numeric) > 0::numeric) AS has_open_pledge
    FROM public.donors d
    LEFT JOIN public.contacts c ON c.id = d.contact_id
    LEFT JOIN filtered_payments fp ON fp.donor_id = d.id
    LEFT JOIN lifetime_last ll ON ll.donor_id = d.id
    LEFT JOIN pledge_balance pb ON pb.donor_id = d.id
    WHERE d.organization_id = p_org_id
    GROUP BY
      d.id,
      d.contact_id,
      d.full_name,
      d.email,
      c.email,
      d.phone,
      c.phone,
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
        OR COALESCE(dr.phone, '') ILIKE '%' || v_search || '%'
        OR COALESCE(dr.email, '') ILIKE '%' || v_search || '%'
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
      AND (
        p_min_total_given IS NULL
        OR p_min_total_given <= 0::numeric
        OR dr.total_donations >= p_min_total_given
      )
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER () AS total_count
    FROM filtered f
  )
  SELECT
    c.id,
    c.contact_id,
    c.full_name,
    c.email,
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

COMMENT ON FUNCTION public.donation_donor_giving_report IS
  'Paginated donor giving report (net amounts, date casts). Includes contact_id, email, and phone.';

GRANT EXECUTE ON FUNCTION public.donation_donor_giving_report(
  uuid, date, date, text, text, text, boolean, numeric, text, boolean, integer, integer
) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.donation_household_giving_report(
  uuid,
  date,
  date,
  text,
  text,
  boolean,
  integer,
  integer
);

CREATE OR REPLACE FUNCTION public.donation_household_giving_report(
  p_org_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort_by text DEFAULT 'total_donations',
  p_sort_asc boolean DEFAULT false,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  family_id uuid,
  family_name text,
  primary_contact_id uuid,
  primary_name text,
  primary_email text,
  primary_phone text,
  member_count bigint,
  total_donations numeric,
  donation_count bigint,
  last_donation_date date,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(btrim(p_search), '');
BEGIN
  RETURN QUERY
  WITH active_members AS (
    SELECT
      fm.family_id,
      fm.contact_id
    FROM public.family_members fm
    INNER JOIN public.families f ON f.id = fm.family_id
    WHERE fm.organization_id = p_org_id
      AND f.organization_id = p_org_id
      AND f.status = 'active'
      AND fm.end_date IS NULL
  ),
  filtered_payments AS (
    SELECT
      am.family_id,
      public.payment_net_amount(pay.amount, pay.refunded_amount) AS net_amount,
      pay.payment_date::date AS payment_date
    FROM public.payments pay
    INNER JOIN active_members am ON am.contact_id = pay.contact_id
    WHERE pay.organization_id = p_org_id
      AND pay.contact_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
      AND public.payment_net_amount(pay.amount, pay.refunded_amount) > 0::numeric
      AND (p_date_from IS NULL OR pay.payment_date::date >= p_date_from)
      AND (p_date_to IS NULL OR pay.payment_date::date <= p_date_to)
  ),
  household_rows AS (
    SELECT
      f.id AS family_id,
      f.name AS family_name,
      f.primary_contact_id,
      COALESCE(pc.full_name, 'Unnamed') AS primary_name,
      NULLIF(btrim(COALESCE(pc.email, '')), '') AS primary_email,
      NULLIF(btrim(COALESCE(pc.phone, '')), '') AS primary_phone,
      COUNT(DISTINCT am.contact_id)::bigint AS member_count,
      COALESCE(SUM(fp.net_amount), 0::numeric) AS total_donations,
      COUNT(fp.net_amount)::bigint AS donation_count,
      MAX(fp.payment_date) AS last_donation_date
    FROM public.families f
    LEFT JOIN active_members am ON am.family_id = f.id
    LEFT JOIN filtered_payments fp ON fp.family_id = f.id
    LEFT JOIN public.contacts pc ON pc.id = f.primary_contact_id
    WHERE f.organization_id = p_org_id
      AND f.status = 'active'
    GROUP BY f.id, f.name, f.primary_contact_id, pc.full_name, pc.email, pc.phone
  ),
  filtered AS (
    SELECT hr.*
    FROM household_rows hr
    WHERE
      v_search IS NULL
      OR hr.family_name ILIKE '%' || v_search || '%'
      OR hr.primary_name ILIKE '%' || v_search || '%'
      OR COALESCE(hr.primary_email, '') ILIKE '%' || v_search || '%'
      OR COALESCE(hr.primary_phone, '') ILIKE '%' || v_search || '%'
      OR EXISTS (
        SELECT 1
        FROM public.family_members fm
        INNER JOIN public.contacts c ON c.id = fm.contact_id
        WHERE fm.family_id = hr.family_id
          AND fm.organization_id = p_org_id
          AND fm.end_date IS NULL
          AND c.full_name ILIKE '%' || v_search || '%'
      )
  )
  SELECT
    f.family_id,
    f.family_name,
    f.primary_contact_id,
    f.primary_name,
    f.primary_email,
    f.primary_phone,
    f.member_count,
    f.total_donations,
    f.donation_count,
    f.last_donation_date,
    COUNT(*) OVER()::bigint AS total_count
  FROM filtered f
  ORDER BY
    CASE WHEN p_sort_by = 'full_name' AND p_sort_asc THEN f.family_name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'full_name' AND NOT p_sort_asc THEN f.family_name END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_donation_date' AND p_sort_asc THEN f.last_donation_date END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_donation_date' AND NOT p_sort_asc THEN f.last_donation_date END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'donation_count' AND p_sort_asc THEN f.donation_count END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'donation_count' AND NOT p_sort_asc THEN f.donation_count END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'total_donations' AND p_sort_asc THEN f.total_donations END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'total_donations' AND NOT p_sort_asc THEN f.total_donations END DESC NULLS LAST,
    f.family_name ASC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.donation_household_giving_report(
  uuid,
  date,
  date,
  text,
  text,
  boolean,
  integer,
  integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.donation_household_giving_report(
  uuid,
  date,
  date,
  text,
  text,
  boolean,
  integer,
  integer
) TO service_role;
