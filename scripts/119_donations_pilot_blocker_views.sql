-- Pilot blockers B1 + B2: pledge_status_view and donor_summary_view
-- Run after 118_payment_import_batch_seen_keys.sql
--
-- B1: Exclude voided payments from pledge amount_paid, balance_remaining, calculated_status
-- B2: Cancelled pledges (pledges.status) emit calculated_status = 'cancelled' and balance_remaining = 0
--     so existing calculated_status <> 'cancelled' filters in collection/allocation/report RPCs work.

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
  CASE
    WHEN LOWER(COALESCE(p.status, '')) = 'cancelled' THEN 0::numeric
    ELSE GREATEST(
      p.amount_pledged - COALESCE(SUM(pay.amount), 0::numeric),
      0::numeric
    )
  END AS balance_remaining,
  p.pledge_date,
  p.pledge_type,
  p.frequency,
  CASE
    WHEN LOWER(COALESCE(p.status, '')) = 'cancelled' THEN 'cancelled'::text
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
LEFT JOIN public.payments p
  ON p.donor_id = d.id
 AND LOWER(COALESCE(p.status, '')) <> 'voided'
GROUP BY d.id;

COMMENT ON VIEW public.pledge_status_view IS
  'Pledge balances from non-voided payments. Cancelled pledges have calculated_status=cancelled and balance_remaining=0. security_invoker.';

COMMENT ON VIEW public.donor_summary_view IS
  'Donor giving summary from non-voided payments. Includes contact_id for reconcile. security_invoker.';
