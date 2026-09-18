-- Household Giving: only families with two or more adult Directory contacts
-- who each have a gift in the selected period. One-parent program households
-- stay in Directory → Families but drop off this report.
-- Also aggregates payments per family (avoids member × payment double count).
-- Replaces donation_household_giving_report from 149 / 150 / 151. Safe to re-run.

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
  pledge_status text,
  outstanding_pledge_balance numeric,
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
  WITH active_adults AS (
    SELECT
      fm.family_id,
      fm.contact_id
    FROM public.family_members fm
    INNER JOIN public.families f ON f.id = fm.family_id
    WHERE fm.organization_id = p_org_id
      AND f.organization_id = p_org_id
      AND f.status = 'active'
      AND fm.end_date IS NULL
      AND fm.contact_id IS NOT NULL
  ),
  filtered_payments AS (
    SELECT
      aa.family_id,
      aa.contact_id,
      public.payment_net_amount(pay.amount, pay.refunded_amount) AS net_amount,
      pay.payment_date::date AS payment_date
    FROM public.payments pay
    INNER JOIN active_adults aa ON aa.contact_id = pay.contact_id
    WHERE pay.organization_id = p_org_id
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
      AND public.payment_net_amount(pay.amount, pay.refunded_amount) > 0::numeric
      AND (p_date_from IS NULL OR pay.payment_date::date >= p_date_from)
      AND (p_date_to IS NULL OR pay.payment_date::date <= p_date_to)
  ),
  qualifying_families AS (
    SELECT aa.family_id
    FROM active_adults aa
    GROUP BY aa.family_id
    HAVING COUNT(DISTINCT aa.contact_id) >= 2
  ),
  multi_adult_donors AS (
    SELECT fp.family_id
    FROM filtered_payments fp
    INNER JOIN qualifying_families qf ON qf.family_id = fp.family_id
    GROUP BY fp.family_id
    HAVING COUNT(DISTINCT fp.contact_id) >= 2
  ),
  payment_totals AS (
    SELECT
      fp.family_id,
      COALESCE(SUM(fp.net_amount), 0::numeric) AS total_donations,
      COUNT(*)::bigint AS donation_count,
      MAX(fp.payment_date) AS last_donation_date
    FROM filtered_payments fp
    INNER JOIN multi_adult_donors mad ON mad.family_id = fp.family_id
    GROUP BY fp.family_id
  ),
  adult_counts AS (
    SELECT
      aa.family_id,
      COUNT(DISTINCT aa.contact_id)::bigint AS member_count
    FROM active_adults aa
    INNER JOIN multi_adult_donors mad ON mad.family_id = aa.family_id
    GROUP BY aa.family_id
  ),
  household_pledge_summary AS (
    SELECT
      aa.family_id,
      COUNT(psv.id)::bigint AS pledge_count,
      COALESCE(SUM(psv.balance_remaining), 0::numeric) AS outstanding_pledge_balance,
      BOOL_OR(
        psv.balance_remaining > 0::numeric
        AND psv.amount_paid > 0::numeric
      ) AS has_partial_pledge
    FROM active_adults aa
    INNER JOIN multi_adult_donors mad ON mad.family_id = aa.family_id
    INNER JOIN public.donors d
      ON d.contact_id = aa.contact_id
     AND d.organization_id = p_org_id
    LEFT JOIN public.pledge_status_view psv
      ON psv.donor_id = d.id
     AND psv.organization_id = p_org_id
     AND LOWER(COALESCE(psv.calculated_status, '')) <> 'cancelled'
    GROUP BY aa.family_id
  ),
  household_rows AS (
    SELECT
      f.id AS family_id,
      f.name AS family_name,
      f.primary_contact_id,
      COALESCE(pc.full_name, 'Unnamed') AS primary_name,
      NULLIF(btrim(COALESCE(pc.email, '')), '') AS primary_email,
      NULLIF(btrim(COALESCE(pc.phone, '')), '') AS primary_phone,
      ac.member_count,
      pt.total_donations,
      pt.donation_count,
      pt.last_donation_date,
      CASE
        WHEN COALESCE(hps.pledge_count, 0) = 0 THEN NULL::text
        WHEN COALESCE(hps.outstanding_pledge_balance, 0::numeric) > 0::numeric THEN
          CASE WHEN hps.has_partial_pledge THEN 'Partial' ELSE 'Open' END
        ELSE 'Fulfilled'
      END AS pledge_status,
      COALESCE(hps.outstanding_pledge_balance, 0::numeric) AS outstanding_pledge_balance
    FROM public.families f
    INNER JOIN multi_adult_donors mad ON mad.family_id = f.id
    INNER JOIN payment_totals pt ON pt.family_id = f.id
    INNER JOIN adult_counts ac ON ac.family_id = f.id
    LEFT JOIN public.contacts pc ON pc.id = f.primary_contact_id
    LEFT JOIN household_pledge_summary hps ON hps.family_id = f.id
    WHERE f.organization_id = p_org_id
      AND f.status = 'active'
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
    f.pledge_status,
    f.outstanding_pledge_balance,
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

COMMENT ON FUNCTION public.donation_household_giving_report(
  uuid,
  date,
  date,
  text,
  text,
  boolean,
  integer,
  integer
) IS
  'Household Giving report: families with 2+ adult Directory contacts who each donated in the period.';
