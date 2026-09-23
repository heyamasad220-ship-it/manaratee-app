-- Speed up Vendor Hub reads and vendor-type saves.
-- Vendor SELECT/UPDATE policies used
--   contact_id IN (SELECT id FROM contacts WHERE auth_user_id = auth.uid())
-- That subquery is subject to contacts RLS (including the per-row family check).
-- With ~5,000 contacts, one application update ran ~9s and Postgres canceled it
-- ("canceling statement due to statement timeout"). Profile and vendor-list loads
-- paid the same cost on every applications / payments / vendor-type query.
--
-- auth_user_contact_ids() is SECURITY DEFINER and uses contacts_auth_user_id_idx,
-- so the check does not re-enter contacts RLS.
--
-- Run in Supabase SQL Editor after 079 / 231. Safe to re-run.

CREATE INDEX IF NOT EXISTS applications_vendor_contact_created_idx
  ON public.applications (organization_id, contact_id, created_at DESC)
  WHERE application_type = 'vendor'
    AND module_owner = 'vendor_hub';

CREATE OR REPLACE FUNCTION public.auth_user_contact_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.organization_id
  FROM public.contacts c
  WHERE c.auth_user_id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.auth_user_contact_organization_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_contact_organization_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_contact_organization_ids() TO service_role;

COMMENT ON FUNCTION public.auth_user_contact_organization_ids IS
  'SECURITY DEFINER: organizations linked to the current auth user. Use in RLS instead of selecting contacts under contacts RLS.';

DROP POLICY IF EXISTS "Vendors can view own vendor applications" ON public.applications;
CREATE POLICY "Vendors can view own vendor applications"
  ON public.applications FOR SELECT
  USING (
    module_owner = 'vendor_hub'
    AND application_type = 'vendor'
    AND contact_id IN (SELECT public.auth_user_contact_ids())
  );

DROP POLICY IF EXISTS "Vendors can update own vendor applications" ON public.applications;
CREATE POLICY "Vendors can update own vendor applications"
  ON public.applications FOR UPDATE
  USING (
    module_owner = 'vendor_hub'
    AND application_type = 'vendor'
    AND contact_id IN (SELECT public.auth_user_contact_ids())
  )
  WITH CHECK (
    module_owner = 'vendor_hub'
    AND application_type = 'vendor'
    AND contact_id IN (SELECT public.auth_user_contact_ids())
  );

DROP POLICY IF EXISTS "Vendors can view own participant status" ON public.vendor_hub_participant_status;
CREATE POLICY "Vendors can view own participant status"
  ON public.vendor_hub_participant_status FOR SELECT
  USING (
    contact_id IN (SELECT public.auth_user_contact_ids())
  );

DROP POLICY IF EXISTS "Vendors can view own booth assignments" ON public.vendor_hub_booth_assignments;
CREATE POLICY "Vendors can view own booth assignments"
  ON public.vendor_hub_booth_assignments FOR SELECT
  USING (
    contact_id IN (SELECT public.auth_user_contact_ids())
  );

DROP POLICY IF EXISTS "Vendors can view own vendor payments" ON public.vendor_hub_payments;
CREATE POLICY "Vendors can view own vendor payments"
  ON public.vendor_hub_payments FOR SELECT
  USING (
    contact_id IN (SELECT public.auth_user_contact_ids())
  );

DROP POLICY IF EXISTS "Vendors can view assigned booths" ON public.vendor_hub_booths;
CREATE POLICY "Vendors can view assigned booths"
  ON public.vendor_hub_booths FOR SELECT
  USING (
    id IN (
      SELECT ba.booth_id
      FROM public.vendor_hub_booth_assignments ba
      WHERE ba.contact_id IN (SELECT public.auth_user_contact_ids())
        AND ba.booth_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Vendors can view org vendor types" ON public.vendor_hub_vendor_types;
CREATE POLICY "Vendors can view org vendor types"
  ON public.vendor_hub_vendor_types FOR SELECT
  USING (
    organization_id IN (SELECT public.auth_user_contact_organization_ids())
  );

DROP POLICY IF EXISTS "Vendors can view own announcement recipients"
  ON public.vendor_hub_announcement_recipients;
CREATE POLICY "Vendors can view own announcement recipients"
  ON public.vendor_hub_announcement_recipients FOR SELECT
  USING (
    contact_id IN (SELECT public.auth_user_contact_ids())
  );

DROP POLICY IF EXISTS "Vendors can update own announcement read status"
  ON public.vendor_hub_announcement_recipients;
CREATE POLICY "Vendors can update own announcement read status"
  ON public.vendor_hub_announcement_recipients FOR UPDATE
  USING (
    contact_id IN (SELECT public.auth_user_contact_ids())
  )
  WITH CHECK (
    contact_id IN (SELECT public.auth_user_contact_ids())
  );
