-- Expose donors.contact_id on donor_summary_view for payment reconcile matching.
-- Run after 097_donations_views.sql (and 115 if applied).

DROP VIEW IF EXISTS public.donor_summary_view;

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

COMMENT ON VIEW public.donor_summary_view IS
  'Donor giving summary from canonical payments. Includes contact_id for reconcile. security_invoker — RLS on donors/payments applies.';
