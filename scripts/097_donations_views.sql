-- Commit donations analytical views with security_invoker (RLS on underlying tables).
-- Run after 096_donations_performance_indexes.sql
--
-- Definitions match production Supabase as of June 2026.
-- Do not change aggregation logic — reporting values must stay consistent.

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
  COALESCE(SUM(pay.amount), 0::numeric) AS amount_paid,
  GREATEST(p.amount_pledged - COALESCE(SUM(pay.amount), 0::numeric), 0::numeric) AS balance_remaining,
  p.pledge_date,
  p.pledge_type,
  p.frequency,
  CASE
    WHEN COALESCE(SUM(pay.amount), 0::numeric) >= p.amount_pledged THEN 'fulfilled'::text
    WHEN COALESCE(SUM(pay.amount), 0::numeric) > 0::numeric THEN 'partial'::text
    ELSE 'open'::text
  END AS calculated_status,
  p.status,
  p.notes,
  p.created_at
FROM public.pledges p
LEFT JOIN public.donors d ON d.id = p.donor_id
LEFT JOIN public.campaigns c ON c.id = p.campaign_id
LEFT JOIN public.payments pay ON pay.pledge_id = p.id
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
  COUNT(DISTINCT p.id) AS donation_count,
  COALESCE(SUM(p.amount), 0::numeric) AS total_donations,
  MAX(p.payment_date) AS last_donation_date,
  (
    EXISTS (
      SELECT 1
      FROM public.pledges pl
      WHERE pl.donor_id = d.id
        AND pl.status = 'open'::text
    )
  ) AS has_open_pledge
FROM public.donors d
LEFT JOIN public.payments p ON p.donor_id = d.id
GROUP BY d.id;

COMMENT ON VIEW public.pledge_status_view IS
  'Pledge balances aggregated from canonical payments. security_invoker — RLS on pledges/payments/donors applies.';

COMMENT ON VIEW public.donor_summary_view IS
  'Donor giving summary from canonical payments. security_invoker — RLS on donors/payments applies.';
