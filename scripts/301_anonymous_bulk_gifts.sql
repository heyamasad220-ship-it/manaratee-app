-- Square taps and counted cash with no name are one payment (sender_name Square bulk / Cash bulk).
-- They stay in collected totals and are not donors.

CREATE OR REPLACE FUNCTION public.donation_campaign_metrics(p_org_id uuid)
RETURNS TABLE (
  campaign_id uuid,
  raised numeric,
  pledged numeric,
  collected_against_pledges numeric,
  outstanding numeric,
  total_committed numeric,
  progress_percent numeric,
  donor_count bigint,
  payment_count bigint,
  average_gift numeric,
  largest_gift numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH resolved_payments AS (
    SELECT
      pay.id,
      pay.amount,
      pay.donor_id,
      pay.contact_id,
      pay.sender_name,
      pay.pledge_id,
      COALESCE(pay.campaign_id, pl.campaign_id) AS effective_campaign_id
    FROM public.payments pay
    LEFT JOIN public.pledges pl ON pl.id = pay.pledge_id
    WHERE pay.organization_id = p_org_id
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
  ),
  payment_agg AS (
    SELECT
      effective_campaign_id AS campaign_id,
      COALESCE(SUM(amount), 0) AS raised,
      COUNT(*)::bigint AS payment_count,
      COALESCE(MAX(amount), 0) AS largest_gift
    FROM resolved_payments
    WHERE effective_campaign_id IS NOT NULL
    GROUP BY effective_campaign_id
  ),
  collected_pledge_agg AS (
    SELECT
      rp.effective_campaign_id AS campaign_id,
      COALESCE(SUM(rp.amount), 0) AS collected_against_pledges
    FROM resolved_payments rp
    INNER JOIN public.pledge_status_view psv
      ON psv.id = rp.pledge_id
     AND psv.organization_id = p_org_id
     AND psv.campaign_id = rp.effective_campaign_id
     AND psv.calculated_status <> 'cancelled'
    WHERE rp.pledge_id IS NOT NULL
    GROUP BY rp.effective_campaign_id
  ),
  pledge_agg AS (
    SELECT
      psv.campaign_id,
      COALESCE(SUM(psv.amount_pledged), 0) AS pledged,
      COALESCE(SUM(GREATEST(psv.balance_remaining, 0)), 0) AS outstanding
    FROM public.pledge_status_view psv
    WHERE psv.organization_id = p_org_id
      AND psv.campaign_id IS NOT NULL
      AND psv.calculated_status <> 'cancelled'
    GROUP BY psv.campaign_id
  ),
  donor_keys AS (
    SELECT effective_campaign_id AS campaign_id, donor_key
    FROM (
      SELECT
        rp.effective_campaign_id,
        CASE
          WHEN LOWER(BTRIM(COALESCE(rp.sender_name, ''))) IN ('square bulk', 'cash bulk') THEN NULL
          WHEN rp.donor_id IS NOT NULL THEN 'donor:' || rp.donor_id::text
          WHEN rp.contact_id IS NOT NULL THEN 'contact:' || rp.contact_id::text
          WHEN NULLIF(BTRIM(rp.sender_name), '') IS NOT NULL THEN 'sender:' || rp.sender_name
        END AS donor_key
      FROM resolved_payments rp
      WHERE rp.effective_campaign_id IS NOT NULL
      UNION ALL
      SELECT
        psv.campaign_id,
        'donor:' || psv.donor_id::text
      FROM public.pledge_status_view psv
      WHERE psv.organization_id = p_org_id
        AND psv.campaign_id IS NOT NULL
        AND psv.calculated_status <> 'cancelled'
        AND psv.donor_id IS NOT NULL
    ) keys
    WHERE donor_key IS NOT NULL
  ),
  donor_agg AS (
    SELECT campaign_id, COUNT(DISTINCT donor_key)::bigint AS donor_count
    FROM donor_keys
    GROUP BY campaign_id
  )
  SELECT
    c.id AS campaign_id,
    COALESCE(pa.raised, 0) AS raised,
    COALESCE(pla.pledged, 0) AS pledged,
    COALESCE(cpa.collected_against_pledges, 0) AS collected_against_pledges,
    COALESCE(pla.outstanding, 0) AS outstanding,
    COALESCE(pa.raised, 0) + COALESCE(pla.outstanding, 0) AS total_committed,
    CASE
      WHEN COALESCE(c.goal_amount, 0) > 0 THEN
        LEAST((COALESCE(pa.raised, 0) / c.goal_amount) * 100, 100)
      ELSE NULL
    END AS progress_percent,
    COALESCE(da.donor_count, 0) AS donor_count,
    COALESCE(pa.payment_count, 0) AS payment_count,
    CASE
      WHEN COALESCE(pa.payment_count, 0) > 0 THEN COALESCE(pa.raised, 0) / pa.payment_count
      ELSE 0
    END AS average_gift,
    COALESCE(pa.largest_gift, 0) AS largest_gift
  FROM public.campaigns c
  LEFT JOIN payment_agg pa ON pa.campaign_id = c.id
  LEFT JOIN pledge_agg pla ON pla.campaign_id = c.id
  LEFT JOIN collected_pledge_agg cpa ON cpa.campaign_id = c.id
  LEFT JOIN donor_agg da ON da.campaign_id = c.id
  WHERE c.organization_id = p_org_id;
$$;
