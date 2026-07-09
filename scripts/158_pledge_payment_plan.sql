-- Pledge installment payment plans for customer portal pledges.
-- Run after 157_recurring_plan_contact_payment_method.sql

ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_payments INTEGER,
  ADD COLUMN IF NOT EXISTS first_payment_date DATE,
  ADD COLUMN IF NOT EXISTS next_payment_date DATE;

COMMENT ON COLUMN public.pledges.installment_amount IS
  'Scheduled amount per installment payment toward amount_pledged.';

COMMENT ON COLUMN public.pledges.total_payments IS
  'Total number of scheduled payments (1 = pay in full).';

COMMENT ON COLUMN public.pledges.first_payment_date IS
  'Date the donor plans to make the first installment payment.';

COMMENT ON COLUMN public.pledges.next_payment_date IS
  'Next scheduled installment due date (staff reminders / portal display).';

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
    WHEN COALESCE(
      SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
      0::numeric
    ) > 0::numeric THEN 'partial'::text
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
  'Pledge balances from net non-voided payment amounts. Includes installment plan fields. security_invoker.';
