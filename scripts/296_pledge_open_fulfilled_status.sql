-- Pledge status is Open (outstanding balance) or Fulfilled.
-- Partial is no longer a distinct status: a partly paid pledge is still open.
-- Backward-compatible. Safe to re-run.
-- Recreates pledge_status_view (and donor_summary_view, which depends on it).

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
  p.campaign_phase_id,
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
  p.installment_amount,
  p.total_payments,
  p.first_payment_date,
  p.next_payment_date,
  CASE
    WHEN LOWER(COALESCE(p.status, '')) = 'cancelled' THEN 'cancelled'::text
    WHEN COALESCE(
      SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
      0::numeric
    ) >= p.amount_pledged THEN 'fulfilled'::text
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
GROUP BY
  p.id,
  d.full_name,
  c.name,
  p.campaign_phase_id,
  p.installment_amount,
  p.total_payments,
  p.first_payment_date,
  p.next_payment_date;

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
  'Pledge balances from net non-voided payment amounts. calculated_status is open (outstanding), fulfilled, or cancelled. security_invoker.';

COMMENT ON VIEW public.donor_summary_view IS
  'Donor giving summary from non-voided payments. has_open_pledge=true only when pledge_status_view.balance_remaining > 0. security_invoker.';

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

COMMENT ON FUNCTION public.refresh_pledge_status(uuid) IS
  'Recompute pledges.status from net non-voided payments (open/fulfilled/cancelled). Remaining balance is always open.';

UPDATE public.pledges
SET status = 'open'
WHERE LOWER(COALESCE(status, '')) = 'partial';
