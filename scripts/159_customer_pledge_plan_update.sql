-- Allow customers to update payment-plan fields on their own pledges.
-- Run after 158_pledge_payment_plan.sql

DROP POLICY IF EXISTS "Customers update own pledge payment plan" ON public.pledges;

CREATE POLICY "Customers update own pledge payment plan"
  ON public.pledges FOR UPDATE
  USING (donor_id IN (SELECT public.auth_user_donor_ids()))
  WITH CHECK (donor_id IN (SELECT public.auth_user_donor_ids()));

COMMENT ON POLICY "Customers update own pledge payment plan" ON public.pledges IS
  'Customers may update their own pledges (e.g. installment plan fields) from the donor portal.';
