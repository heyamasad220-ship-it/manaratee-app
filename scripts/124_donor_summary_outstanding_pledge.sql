-- Fix has_open_pledge: use outstanding balance, not stale pledges.status
-- Run after 123_organization_subscription_terms.sql

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
        WHEN COALESCE(SUM(pay.amount), 0::numeric) >= p.amount_pledged THEN 'fulfilled'
        WHEN COALESCE(SUM(pay.amount), 0::numeric) > 0::numeric THEN 'partial'
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
  'Recompute pledges.status from non-voided payment totals (open/partial/fulfilled/cancelled).';

-- Backfill existing pledges (e.g. fulfilled but still status=open)
DO $$
DECLARE
  pledge_row RECORD;
BEGIN
  FOR pledge_row IN SELECT id FROM public.pledges LOOP
    PERFORM public.refresh_pledge_status(pledge_row.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.sync_pledge_status_on_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pledge_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pledge_id := OLD.pledge_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.pledge_id IS NOT NULL
       AND OLD.pledge_id IS DISTINCT FROM NEW.pledge_id THEN
      PERFORM public.refresh_pledge_status(OLD.pledge_id);
    END IF;
    pledge_id := NEW.pledge_id;
  ELSE
    pledge_id := NEW.pledge_id;
  END IF;

  IF pledge_id IS NOT NULL THEN
    PERFORM public.refresh_pledge_status(pledge_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_pledge_status_after_payment_change ON public.payments;

CREATE TRIGGER sync_pledge_status_after_payment_change
  AFTER INSERT OR UPDATE OF pledge_id, amount, status OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pledge_status_on_payment_change();

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

COMMENT ON VIEW public.donor_summary_view IS
  'Donor giving summary from non-voided payments. has_open_pledge=true only when pledge_status_view.balance_remaining > 0. security_invoker.';
