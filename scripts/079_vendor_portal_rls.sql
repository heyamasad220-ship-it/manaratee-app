-- Vendor portal: link contacts to auth users and allow vendors to read their own participation
-- Run in Supabase SQL Editor after 078_vendor_hub_booth_setup_templates.sql

CREATE OR REPLACE FUNCTION public.link_contacts_to_auth_user()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_count integer;
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  user_email := lower(coalesce(auth.jwt()->>'email', ''));
  IF user_email = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.contacts
  SET auth_user_id = auth.uid(),
      updated_at = NOW()
  WHERE auth_user_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = user_email;

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;

REVOKE ALL ON FUNCTION public.link_contacts_to_auth_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_contacts_to_auth_user() TO authenticated;

DROP POLICY IF EXISTS "Contacts can view organizations via auth link" ON public.organizations;
CREATE POLICY "Contacts can view organizations via auth link"
  ON public.organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.contacts
      WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can view own vendor applications" ON public.applications;
CREATE POLICY "Vendors can view own vendor applications"
  ON public.applications FOR SELECT
  USING (
    module_owner = 'vendor_hub'
    AND application_type = 'vendor'
    AND contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can view own participant status" ON public.vendor_hub_participant_status;
CREATE POLICY "Vendors can view own participant status"
  ON public.vendor_hub_participant_status FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can view own booth assignments" ON public.vendor_hub_booth_assignments;
CREATE POLICY "Vendors can view own booth assignments"
  ON public.vendor_hub_booth_assignments FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can view own vendor payments" ON public.vendor_hub_payments;
CREATE POLICY "Vendors can view own vendor payments"
  ON public.vendor_hub_payments FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can view related bazaar events" ON public.vendor_hub_events;
CREATE POLICY "Vendors can view related bazaar events"
  ON public.vendor_hub_events FOR SELECT
  USING (
    id IN (
      SELECT vendor_hub_event_id FROM public.vendor_hub_participant_status ps
      WHERE ps.contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
    )
    OR id IN (
      SELECT ba.event_id FROM public.vendor_hub_booth_assignments ba
      WHERE ba.contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
      AND ba.event_id IS NOT NULL
    )
    OR id IN (
      SELECT p.event_id FROM public.vendor_hub_payments p
      WHERE p.contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
      AND p.event_id IS NOT NULL
    )
    OR calendar_status IN ('community_visible', 'published')
  );

DROP POLICY IF EXISTS "Vendors can view assigned booths" ON public.vendor_hub_booths;
CREATE POLICY "Vendors can view assigned booths"
  ON public.vendor_hub_booths FOR SELECT
  USING (
    id IN (
      SELECT booth_id FROM public.vendor_hub_booth_assignments ba
      WHERE ba.contact_id IN (
        SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
      )
      AND ba.booth_id IS NOT NULL
    )
  );

COMMENT ON FUNCTION public.link_contacts_to_auth_user IS
  'Links org-scoped CRM contacts to the current auth user when email matches.';
