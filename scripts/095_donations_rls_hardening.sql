-- Donations canonical ledger RLS + permission-aware staff policies.
-- Run after 094_transactional_email.sql

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER — permission checks for RLS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_is_active_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_org_id
      AND COALESCE(om.status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_is_org_owner(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = p_org_id
      AND om.role = 'owner'
      AND COALESCE(om.status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_has_donation_permission(
  p_org_id uuid,
  p_permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_is_org_owner(p_org_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.role_permissions rp
        ON rp.organization_id = om.organization_id
       AND rp.role_id = om.role_id
      WHERE om.user_id = auth.uid()
        AND om.organization_id = p_org_id
        AND COALESCE(om.status, 'active') = 'active'
        AND rp.permission_key = p_permission_key
        AND rp.enabled = true
    );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can_view_donations(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_has_donation_permission(p_org_id, 'donations.view')
    OR public.auth_user_has_donation_permission(p_org_id, 'donations.manage');
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can_manage_donations(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_has_donation_permission(p_org_id, 'donations.manage');
$$;

CREATE OR REPLACE FUNCTION public.auth_user_contact_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.contacts c
  WHERE c.auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_donor_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.donors d
  WHERE d.contact_id IN (SELECT public.auth_user_contact_ids());
$$;

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org payments" ON public.payments;
DROP POLICY IF EXISTS "Staff manage org payments" ON public.payments;
DROP POLICY IF EXISTS "Staff update org payments" ON public.payments;
DROP POLICY IF EXISTS "Staff delete org payments" ON public.payments;
DROP POLICY IF EXISTS "Customers view own payments" ON public.payments;
DROP POLICY IF EXISTS "Customers insert own portal payments" ON public.payments;

CREATE POLICY "Staff view org payments"
  ON public.payments FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage org payments"
  ON public.payments FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org payments"
  ON public.payments FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org payments"
  ON public.payments FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Customers view own payments"
  ON public.payments FOR SELECT
  USING (contact_id IN (SELECT public.auth_user_contact_ids()));

CREATE POLICY "Customers insert own portal payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    contact_id IN (SELECT public.auth_user_contact_ids())
    AND organization_id IN (
      SELECT c.organization_id
      FROM public.contacts c
      WHERE c.id = contact_id
        AND c.auth_user_id = auth.uid()
    )
    AND source_type = 'portal'
  );

-- ---------------------------------------------------------------------------
-- pledges
-- ---------------------------------------------------------------------------

ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org pledges" ON public.pledges;
DROP POLICY IF EXISTS "Staff manage org pledges" ON public.pledges;
DROP POLICY IF EXISTS "Staff update org pledges" ON public.pledges;
DROP POLICY IF EXISTS "Staff delete org pledges" ON public.pledges;
DROP POLICY IF EXISTS "Customers view own pledges" ON public.pledges;
DROP POLICY IF EXISTS "Customers insert own pledges" ON public.pledges;

CREATE POLICY "Staff view org pledges"
  ON public.pledges FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage org pledges"
  ON public.pledges FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org pledges"
  ON public.pledges FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org pledges"
  ON public.pledges FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Customers view own pledges"
  ON public.pledges FOR SELECT
  USING (donor_id IN (SELECT public.auth_user_donor_ids()));

CREATE POLICY "Customers insert own pledges"
  ON public.pledges FOR INSERT
  WITH CHECK (
    donor_id IN (SELECT public.auth_user_donor_ids())
    AND organization_id IN (
      SELECT d.organization_id
      FROM public.donors d
      WHERE d.id = donor_id
    )
  );

-- ---------------------------------------------------------------------------
-- donors
-- ---------------------------------------------------------------------------

ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org donors" ON public.donors;
DROP POLICY IF EXISTS "Staff manage org donors" ON public.donors;
DROP POLICY IF EXISTS "Staff update org donors" ON public.donors;
DROP POLICY IF EXISTS "Staff delete org donors" ON public.donors;
DROP POLICY IF EXISTS "Customers view own donor profile" ON public.donors;
DROP POLICY IF EXISTS "Customers create own donor profile" ON public.donors;

CREATE POLICY "Staff view org donors"
  ON public.donors FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage org donors"
  ON public.donors FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org donors"
  ON public.donors FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org donors"
  ON public.donors FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Customers view own donor profile"
  ON public.donors FOR SELECT
  USING (contact_id IN (SELECT public.auth_user_contact_ids()));

CREATE POLICY "Customers create own donor profile"
  ON public.donors FOR INSERT
  WITH CHECK (
    contact_id IN (SELECT public.auth_user_contact_ids())
    AND organization_id IN (
      SELECT c.organization_id
      FROM public.contacts c
      WHERE c.id = contact_id
        AND c.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Upgrade existing donation table policies to permission-aware staff access
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Org members manage recurring donation plans" ON public.recurring_donation_plans;
DROP POLICY IF EXISTS "Staff view recurring donation plans" ON public.recurring_donation_plans;
DROP POLICY IF EXISTS "Staff manage recurring donation plans" ON public.recurring_donation_plans;
DROP POLICY IF EXISTS "Staff update recurring donation plans" ON public.recurring_donation_plans;
DROP POLICY IF EXISTS "Staff delete recurring donation plans" ON public.recurring_donation_plans;

CREATE POLICY "Staff view recurring donation plans"
  ON public.recurring_donation_plans FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage recurring donation plans"
  ON public.recurring_donation_plans FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update recurring donation plans"
  ON public.recurring_donation_plans FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete recurring donation plans"
  ON public.recurring_donation_plans FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

DROP POLICY IF EXISTS "Org members manage donation settings" ON public.donation_settings;
DROP POLICY IF EXISTS "Staff manage donation settings" ON public.donation_settings;

CREATE POLICY "Staff manage donation settings"
  ON public.donation_settings FOR ALL
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

DROP POLICY IF EXISTS "Org members manage donation receipts" ON public.donation_receipts;
DROP POLICY IF EXISTS "Staff view donation receipts" ON public.donation_receipts;
DROP POLICY IF EXISTS "Staff manage donation receipts" ON public.donation_receipts;
DROP POLICY IF EXISTS "Staff update donation receipts" ON public.donation_receipts;
DROP POLICY IF EXISTS "Staff delete donation receipts" ON public.donation_receipts;

CREATE POLICY "Staff view donation receipts"
  ON public.donation_receipts FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage donation receipts"
  ON public.donation_receipts FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update donation receipts"
  ON public.donation_receipts FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete donation receipts"
  ON public.donation_receipts FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

DROP POLICY IF EXISTS "Org members manage pledge reminders" ON public.pledge_reminders;
DROP POLICY IF EXISTS "Staff view pledge reminders" ON public.pledge_reminders;
DROP POLICY IF EXISTS "Staff manage pledge reminders" ON public.pledge_reminders;
DROP POLICY IF EXISTS "Staff update pledge reminders" ON public.pledge_reminders;
DROP POLICY IF EXISTS "Staff delete pledge reminders" ON public.pledge_reminders;

CREATE POLICY "Staff view pledge reminders"
  ON public.pledge_reminders FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage pledge reminders"
  ON public.pledge_reminders FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update pledge reminders"
  ON public.pledge_reminders FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete pledge reminders"
  ON public.pledge_reminders FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

DROP POLICY IF EXISTS "Org members manage donation checkout sessions" ON public.donation_checkout_sessions;
DROP POLICY IF EXISTS "Staff view donation checkout sessions" ON public.donation_checkout_sessions;
DROP POLICY IF EXISTS "Staff manage donation checkout sessions" ON public.donation_checkout_sessions;

CREATE POLICY "Staff view donation checkout sessions"
  ON public.donation_checkout_sessions FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff manage donation checkout sessions"
  ON public.donation_checkout_sessions FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

DROP POLICY IF EXISTS "Customers view own donation checkout sessions" ON public.donation_checkout_sessions;
CREATE POLICY "Customers view own donation checkout sessions"
  ON public.donation_checkout_sessions FOR SELECT
  USING (contact_id IN (SELECT public.auth_user_contact_ids()));

DROP POLICY IF EXISTS "Org members view processor events" ON public.payment_processor_events;
DROP POLICY IF EXISTS "Staff view processor events" ON public.payment_processor_events;

CREATE POLICY "Staff view processor events"
  ON public.payment_processor_events FOR SELECT
  USING (
    organization_id IS NULL
    OR public.auth_user_can_view_donations(organization_id)
  );

COMMENT ON FUNCTION public.auth_user_can_view_donations IS
  'RLS helper: true when auth user has donations.view or donations.manage in the org (or is owner).';

COMMENT ON FUNCTION public.auth_user_can_manage_donations IS
  'RLS helper: true when auth user has donations.manage in the org (or is owner).';
