-- Donations reporting scalability RPCs (campaign analytics, reports, recurring).
-- Run after 098_donations_dashboard_rpcs.sql

-- ---------------------------------------------------------------------------
-- Campaign metrics (mirrors lib/donations/campaign-analytics.ts computeCampaignMetrics)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Campaign recent activity (top-N per category for detail page)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.donation_campaign_recent_activity(
  p_org_id uuid,
  p_campaign_id uuid,
  p_limit integer DEFAULT 8
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH resolved_payments AS (
    SELECT
      pay.id,
      pay.campaign_id,
      pay.pledge_id,
      pay.donor_id,
      pay.contact_id,
      pay.sender_name,
      pay.amount,
      pay.payment_date,
      pay.source,
      pay.status,
      COALESCE(pay.campaign_id, pl.campaign_id) AS effective_campaign_id
    FROM public.payments pay
    LEFT JOIN public.pledges pl ON pl.id = pay.pledge_id
    WHERE pay.organization_id = p_org_id
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
  ),
  campaign_pledge_ids AS (
    SELECT psv.id
    FROM public.pledge_status_view psv
    WHERE psv.organization_id = p_org_id
      AND psv.campaign_id = p_campaign_id
      AND psv.calculated_status <> 'cancelled'
  ),
  recent_pledges AS (
    SELECT jsonb_agg(row_to_json(r) ORDER BY r.pledge_date DESC) AS data
    FROM (
      SELECT
        psv.id,
        psv.campaign_id,
        psv.donor_id,
        psv.donor_name,
        psv.amount_pledged,
        psv.amount_paid,
        psv.balance_remaining,
        psv.calculated_status,
        psv.pledge_date
      FROM public.pledge_status_view psv
      WHERE psv.organization_id = p_org_id
        AND psv.campaign_id = p_campaign_id
        AND psv.calculated_status <> 'cancelled'
      ORDER BY psv.pledge_date DESC NULLS LAST
      LIMIT GREATEST(p_limit, 1)
    ) r
  ),
  recent_donations AS (
    SELECT jsonb_agg(row_to_json(r) ORDER BY r.payment_date DESC) AS data
    FROM (
      SELECT
        rp.id,
        rp.campaign_id,
        rp.pledge_id,
        rp.donor_id,
        rp.contact_id,
        rp.sender_name,
        rp.amount,
        rp.payment_date,
        rp.source,
        rp.status
      FROM resolved_payments rp
      WHERE rp.effective_campaign_id = p_campaign_id
        AND rp.pledge_id IS NULL
      ORDER BY rp.payment_date DESC NULLS LAST
      LIMIT GREATEST(p_limit, 1)
    ) r
  ),
  recent_pledge_payments AS (
    SELECT jsonb_agg(row_to_json(r) ORDER BY r.payment_date DESC) AS data
    FROM (
      SELECT
        rp.id,
        rp.campaign_id,
        rp.pledge_id,
        rp.donor_id,
        rp.contact_id,
        rp.sender_name,
        rp.amount,
        rp.payment_date,
        rp.source,
        rp.status
      FROM resolved_payments rp
      WHERE rp.effective_campaign_id = p_campaign_id
        AND rp.pledge_id IS NOT NULL
        AND rp.pledge_id IN (SELECT id FROM campaign_pledge_ids)
      ORDER BY rp.payment_date DESC NULLS LAST
      LIMIT GREATEST(p_limit, 1)
    ) r
  )
  SELECT jsonb_build_object(
    'recentDonations', COALESCE((SELECT data FROM recent_donations), '[]'::jsonb),
    'recentPledges', COALESCE((SELECT data FROM recent_pledges), '[]'::jsonb),
    'recentPledgePayments', COALESCE((SELECT data FROM recent_pledge_payments), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Reports overview (excludes voided — aligned with dashboard; superseded by 120_donations_pilot_blocker_totals.sql)
-- ---------------------------------------------------------------------------

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
  SELECT
    COALESCE((SELECT SUM(amount) FROM public.payments WHERE organization_id = p_org_id), 0),
    (SELECT COUNT(*)::bigint FROM public.payments WHERE organization_id = p_org_id),
    CASE
      WHEN (SELECT COUNT(*) FROM public.payments WHERE organization_id = p_org_id) > 0 THEN
        (SELECT SUM(amount) FROM public.payments WHERE organization_id = p_org_id)
        / (SELECT COUNT(*) FROM public.payments WHERE organization_id = p_org_id)
      ELSE 0
    END,
    (SELECT COUNT(*)::bigint FROM public.donor_summary_view WHERE organization_id = p_org_id);
$$;

-- ---------------------------------------------------------------------------
-- Tax year donor totals (excludes voided)
-- ---------------------------------------------------------------------------

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
    COALESCE(d.full_name, pay.sender_name, 'Unknown') AS donor_name,
    d.email AS donor_email,
    COALESCE(SUM(pay.amount), 0) AS total_amount,
    COUNT(*)::bigint AS payment_count
  FROM public.payments pay
  LEFT JOIN public.donors d ON d.id = pay.donor_id
  WHERE pay.organization_id = p_org_id
    AND pay.donor_id IS NOT NULL
    AND pay.payment_date IS NOT NULL
    AND EXTRACT(YEAR FROM pay.payment_date)::integer = p_tax_year
    AND LOWER(COALESCE(pay.status, '')) <> 'voided'
  GROUP BY pay.donor_id, d.full_name, d.email, pay.sender_name
  ORDER BY total_amount DESC;
$$;

-- ---------------------------------------------------------------------------
-- Recurring report summary
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.donation_recurring_report_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH valid_payments AS (
    SELECT
      pay.amount,
      pay.donor_id,
      pay.campaign_id,
      pay.recurring_donation_plan_id,
      d.full_name AS donor_name,
      c.name AS campaign_name
    FROM public.payments pay
    LEFT JOIN public.donors d ON d.id = pay.donor_id
    LEFT JOIN public.campaigns c ON c.id = pay.campaign_id
    WHERE pay.organization_id = p_org_id
      AND pay.recurring_donation_plan_id IS NOT NULL
      AND LOWER(COALESCE(pay.status, '')) <> 'voided'
  ),
  by_campaign AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'campaignId', campaign_id,
        'campaignName', COALESCE(campaign_name, 'No Campaign'),
        'total', total,
        'donorCount', donor_count
      )
      ORDER BY total DESC
    ) AS data
    FROM (
      SELECT
        campaign_id,
        MAX(campaign_name) AS campaign_name,
        COALESCE(SUM(amount), 0) AS total,
        COUNT(DISTINCT donor_id)::bigint AS donor_count
      FROM valid_payments
      GROUP BY campaign_id
    ) grouped
  ),
  by_donor AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'donorId', donor_id,
        'donorName', COALESCE(donor_name, 'Unknown Donor'),
        'total', total,
        'planCount', plan_count
      )
      ORDER BY total DESC
    ) AS data
    FROM (
      SELECT
        donor_id,
        MAX(donor_name) AS donor_name,
        COALESCE(SUM(amount), 0) AS total,
        COUNT(DISTINCT recurring_donation_plan_id)::bigint AS plan_count
      FROM valid_payments
      WHERE donor_id IS NOT NULL
      GROUP BY donor_id
    ) grouped
  )
  SELECT jsonb_build_object(
    'recurringDonorCount', (SELECT COUNT(DISTINCT donor_id)::bigint FROM valid_payments WHERE donor_id IS NOT NULL),
    'totalRecurringRevenue', (SELECT COALESCE(SUM(amount), 0) FROM valid_payments),
    'byCampaign', COALESCE((SELECT data FROM by_campaign), '[]'::jsonb),
    'byDonor', COALESCE((SELECT data FROM by_donor), '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.donation_campaign_metrics IS
  'Per-campaign fundraising metrics — SQL equivalent of buildCampaignAnalytics.';

COMMENT ON FUNCTION public.donation_campaign_recent_activity IS
  'Recent donations, pledges, and pledge payments for a single campaign (limited).';

COMMENT ON FUNCTION public.donation_org_reports_overview IS
  'Reports overview totals (excludes voided payment amounts; aligned with dashboard).';

COMMENT ON FUNCTION public.donation_donor_tax_year_totals IS
  'Per-donor giving totals for tax year statements (excludes voided).';

COMMENT ON FUNCTION public.donation_recurring_report_summary IS
  'Recurring donation report aggregates by campaign and donor.';
