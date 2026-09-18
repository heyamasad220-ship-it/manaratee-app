-- Permission-aware RLS for donation categories and funds.
-- Settings → Categories queried these tables from the browser, but policies still
-- required profiles.role IN ('owner', 'admin') and profiles.organization_id.
-- Staff with Super Admin / donations.manage (or a switched org) saw an empty list
-- even though the rows were still in the database.
-- Requires helpers from 095_donations_rls_hardening.sql. Safe to re-run.

ALTER TABLE public.donation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can manage donation categories" ON public.donation_categories;
DROP POLICY IF EXISTS "Customers can read org donation categories" ON public.donation_categories;
DROP POLICY IF EXISTS "Staff view org donation categories" ON public.donation_categories;
DROP POLICY IF EXISTS "Staff manage org donation categories" ON public.donation_categories;
DROP POLICY IF EXISTS "Staff update org donation categories" ON public.donation_categories;
DROP POLICY IF EXISTS "Staff delete org donation categories" ON public.donation_categories;

CREATE POLICY "Staff view org donation categories"
  ON public.donation_categories FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage org donation categories"
  ON public.donation_categories FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org donation categories"
  ON public.donation_categories FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org donation categories"
  ON public.donation_categories FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Customers can read org donation categories"
  ON public.donation_categories FOR SELECT
  USING (
    organization_id IN (
      SELECT contacts.organization_id
      FROM contacts
      WHERE contacts.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organization admins can manage their donation subcategories" ON public.donation_subcategories;
DROP POLICY IF EXISTS "Customers can read org donation subcategories" ON public.donation_subcategories;
DROP POLICY IF EXISTS "Staff view org donation funds" ON public.donation_subcategories;
DROP POLICY IF EXISTS "Staff manage org donation funds" ON public.donation_subcategories;
DROP POLICY IF EXISTS "Staff update org donation funds" ON public.donation_subcategories;
DROP POLICY IF EXISTS "Staff delete org donation funds" ON public.donation_subcategories;

CREATE POLICY "Staff view org donation funds"
  ON public.donation_subcategories FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage org donation funds"
  ON public.donation_subcategories FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org donation funds"
  ON public.donation_subcategories FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org donation funds"
  ON public.donation_subcategories FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Customers can read org donation subcategories"
  ON public.donation_subcategories FOR SELECT
  USING (
    organization_id IN (
      SELECT contacts.organization_id
      FROM contacts
      WHERE contacts.auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.donation_categories IS
  'Donation categories — RLS: staff donations.view/manage; customers SELECT their org for portal pickers.';

COMMENT ON TABLE public.donation_subcategories IS
  'Donation funds under a category — RLS: staff donations.view/manage; customers SELECT their org for portal pickers.';
