-- Speed up Group Giving: page first, then attach member counts and pledges
-- only for the current page. Split payment scan so attributed-group gifts
-- can use the partial index from 136.
-- Safe to re-run. Same function signature as 166.

CREATE OR REPLACE FUNCTION public.donation_group_giving_report(
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
  group_contact_id uuid,
  group_name text,
  primary_contact_name text,
  member_count bigint,
  group_gifts_total numeric,
  member_gifts_total numeric,
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
  WITH filtered_payments AS (
    SELECT
      pay.attributed_group_contact_id AS group_contact_id,
      'member'::text AS gift_kind,
      public.payment_net_amount(pay.amount, pay.refunded_amount) AS net_amount,
      pay.payment_date::date AS payment_date
    FROM public.payments pay
    WHERE pay.organization_id = p_org_id
      AND pay.attributed_group_contact_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
      AND public.payment_net_amount(pay.amount, pay.refunded_amount) > 0::numeric
      AND (p_date_from IS NULL OR pay.payment_date::date >= p_date_from)
      AND (p_date_to IS NULL OR pay.payment_date::date <= p_date_to)
    UNION ALL
    SELECT
      pay.contact_id AS group_contact_id,
      'group'::text AS gift_kind,
      public.payment_net_amount(pay.amount, pay.refunded_amount) AS net_amount,
      pay.payment_date::date AS payment_date
    FROM public.payments pay
    INNER JOIN public.contacts g
      ON g.id = pay.contact_id
     AND g.organization_id = p_org_id
     AND g.contact_type = 'group'
    WHERE pay.organization_id = p_org_id
      AND pay.attributed_group_contact_id IS NULL
      AND pay.contact_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
      AND public.payment_net_amount(pay.amount, pay.refunded_amount) > 0::numeric
      AND (p_date_from IS NULL OR pay.payment_date::date >= p_date_from)
      AND (p_date_to IS NULL OR pay.payment_date::date <= p_date_to)
  ),
  group_totals AS (
    SELECT
      fp.group_contact_id,
      COALESCE(SUM(fp.net_amount) FILTER (WHERE fp.gift_kind = 'group'), 0::numeric) AS group_gifts_total,
      COALESCE(SUM(fp.net_amount) FILTER (WHERE fp.gift_kind = 'member'), 0::numeric) AS member_gifts_total,
      COALESCE(SUM(fp.net_amount), 0::numeric) AS total_donations,
      COUNT(fp.net_amount)::bigint AS donation_count,
      MAX(fp.payment_date) AS last_donation_date
    FROM filtered_payments fp
    GROUP BY fp.group_contact_id
    HAVING COUNT(fp.net_amount) > 0
  ),
  group_rows AS (
    SELECT
      g.id AS group_contact_id,
      COALESCE(NULLIF(btrim(g.full_name), ''), NULLIF(btrim(g.primary_contact_name), ''), 'Unnamed group') AS group_name,
      NULLIF(btrim(g.primary_contact_name), '') AS primary_contact_name,
      gt.group_gifts_total,
      gt.member_gifts_total,
      gt.total_donations,
      gt.donation_count,
      gt.last_donation_date
    FROM group_totals gt
    INNER JOIN public.contacts g
      ON g.id = gt.group_contact_id
     AND g.organization_id = p_org_id
     AND g.contact_type = 'group'
  ),
  filtered AS (
    SELECT gr.*
    FROM group_rows gr
    WHERE
      v_search IS NULL
      OR gr.group_name ILIKE '%' || v_search || '%'
      OR COALESCE(gr.primary_contact_name, '') ILIKE '%' || v_search || '%'
      OR EXISTS (
        SELECT 1
        FROM public.contact_group_members cgm
        INNER JOIN public.contacts c ON c.id = cgm.member_contact_id
        WHERE cgm.group_contact_id = gr.group_contact_id
          AND cgm.organization_id = p_org_id
          AND cgm.status = 'active'
          AND c.full_name ILIKE '%' || v_search || '%'
      )
  ),
  paged AS (
    SELECT
      f.*,
      COUNT(*) OVER()::bigint AS total_count
    FROM filtered f
    ORDER BY
      CASE WHEN p_sort_by = 'full_name' AND p_sort_asc THEN f.group_name END ASC NULLS LAST,
      CASE WHEN p_sort_by = 'full_name' AND NOT p_sort_asc THEN f.group_name END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'last_donation_date' AND p_sort_asc THEN f.last_donation_date END ASC NULLS LAST,
      CASE WHEN p_sort_by = 'last_donation_date' AND NOT p_sort_asc THEN f.last_donation_date END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'donation_count' AND p_sort_asc THEN f.donation_count END ASC NULLS LAST,
      CASE WHEN p_sort_by = 'donation_count' AND NOT p_sort_asc THEN f.donation_count END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'total_donations' AND p_sort_asc THEN f.total_donations END ASC NULLS LAST,
      CASE WHEN p_sort_by = 'total_donations' AND NOT p_sort_asc THEN f.total_donations END DESC NULLS LAST,
      f.group_name ASC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  ),
  member_counts AS (
    SELECT
      cgm.group_contact_id,
      COUNT(*)::bigint AS member_count
    FROM public.contact_group_members cgm
    WHERE cgm.organization_id = p_org_id
      AND cgm.status = 'active'
      AND cgm.group_contact_id IN (SELECT p.group_contact_id FROM paged p)
    GROUP BY cgm.group_contact_id
  ),
  group_pledge_summary AS (
    SELECT
      p.group_contact_id,
      COUNT(psv.id)::bigint AS pledge_count,
      COALESCE(SUM(psv.balance_remaining), 0::numeric) AS outstanding_pledge_balance,
      BOOL_OR(
        psv.balance_remaining > 0::numeric
        AND psv.amount_paid > 0::numeric
      ) AS has_partial_pledge
    FROM paged p
    INNER JOIN public.donors d
      ON d.contact_id = p.group_contact_id
     AND d.organization_id = p_org_id
    LEFT JOIN public.pledge_status_view psv
      ON psv.donor_id = d.id
     AND psv.organization_id = p_org_id
     AND LOWER(COALESCE(psv.calculated_status, '')) <> 'cancelled'
    GROUP BY p.group_contact_id
  )
  SELECT
    p.group_contact_id,
    p.group_name,
    p.primary_contact_name,
    COALESCE(mc.member_count, 0::bigint) AS member_count,
    p.group_gifts_total,
    p.member_gifts_total,
    p.total_donations,
    p.donation_count,
    p.last_donation_date,
    CASE
      WHEN COALESCE(gps.pledge_count, 0) = 0 THEN NULL::text
      WHEN COALESCE(gps.outstanding_pledge_balance, 0::numeric) > 0::numeric THEN
        CASE WHEN gps.has_partial_pledge THEN 'Partial' ELSE 'Open' END
      ELSE 'Fulfilled'
    END AS pledge_status,
    COALESCE(gps.outstanding_pledge_balance, 0::numeric) AS outstanding_pledge_balance,
    p.total_count
  FROM paged p
  LEFT JOIN member_counts mc ON mc.group_contact_id = p.group_contact_id
  LEFT JOIN group_pledge_summary gps ON gps.group_contact_id = p.group_contact_id
  ORDER BY
    CASE WHEN p_sort_by = 'full_name' AND p_sort_asc THEN p.group_name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'full_name' AND NOT p_sort_asc THEN p.group_name END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'last_donation_date' AND p_sort_asc THEN p.last_donation_date END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_donation_date' AND NOT p_sort_asc THEN p.last_donation_date END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'donation_count' AND p_sort_asc THEN p.donation_count END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'donation_count' AND NOT p_sort_asc THEN p.donation_count END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'total_donations' AND p_sort_asc THEN p.total_donations END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'total_donations' AND NOT p_sort_asc THEN p.total_donations END DESC NULLS LAST,
    p.group_name ASC;
END;
$$;

COMMENT ON FUNCTION public.donation_group_giving_report IS
  'Paginated group giving report: group gifts + attributed member gifts. Member/pledge columns are computed only for the current page.';

GRANT EXECUTE ON FUNCTION public.donation_group_giving_report(
  uuid,
  date,
  date,
  text,
  text,
  boolean,
  integer,
  integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.donation_group_giving_report(
  uuid,
  date,
  date,
  text,
  text,
  boolean,
  integer,
  integer
) TO service_role;
