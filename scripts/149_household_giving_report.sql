-- Household / family giving report RPC (aggregates member contact gifts; no family_id on payments).
-- Run after 148_families_and_family_members.sql

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
    GROUP BY f.id, f.name, f.primary_contact_id, pc.full_name
  ),
  filtered AS (
    SELECT hr.*
    FROM household_rows hr
    WHERE
      v_search IS NULL
      OR hr.family_name ILIKE '%' || v_search || '%'
      OR hr.primary_name ILIKE '%' || v_search || '%'
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
