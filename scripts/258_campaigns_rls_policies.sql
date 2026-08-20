-- Permission-aware RLS for fundraising campaigns.
-- Fixes "Error saving campaign" / 42501 when campaigns has RLS enabled
-- but no INSERT policy (095 hardened payments/pledges/donors, not campaigns).
-- Requires helpers from 095_donations_rls_hardening.sql. Safe to re-run.

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Staff manage org campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Staff update org campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Staff delete org campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Org members view active campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Customers view active campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Organization members can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Organization members can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Organization members can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Organization members can delete campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Organization members can manage campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Org members manage campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Org members view campaigns" ON public.campaigns;

CREATE POLICY "Staff view org campaigns"
  ON public.campaigns FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage org campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaigns"
  ON public.campaigns FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaigns"
  ON public.campaigns FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- Customer portal campaign pickers (active campaigns only).
CREATE POLICY "Org members view active campaigns"
  ON public.campaigns FOR SELECT
  USING (
    public.auth_user_is_active_org_member(organization_id)
    AND lower(coalesce(status, 'active')) = 'active'
  );

COMMENT ON TABLE public.campaigns IS
  'Fundraising campaigns — RLS: staff donations.view/manage; org members SELECT active rows for portal pickers.';
