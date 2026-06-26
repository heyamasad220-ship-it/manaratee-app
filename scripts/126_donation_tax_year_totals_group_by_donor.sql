-- Fix duplicate donor rows when payments have varying sender_name for the same donor_id.

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
    COALESCE(MAX(d.full_name), MAX(pay.sender_name), 'Unknown') AS donor_name,
    MAX(d.email) AS donor_email,
    COALESCE(SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)), 0) AS total_amount,
    COUNT(*) FILTER (
      WHERE public.payment_net_amount(pay.amount, pay.refunded_amount) > 0
    )::bigint AS payment_count
  FROM public.payments pay
  LEFT JOIN public.donors d ON d.id = pay.donor_id
  WHERE pay.organization_id = p_org_id
    AND pay.donor_id IS NOT NULL
    AND pay.payment_date IS NOT NULL
    AND EXTRACT(YEAR FROM pay.payment_date)::integer = p_tax_year
    AND LOWER(COALESCE(pay.status, '')) <> 'voided'
  GROUP BY pay.donor_id
  HAVING COALESCE(SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)), 0) > 0
  ORDER BY total_amount DESC;
$$;
