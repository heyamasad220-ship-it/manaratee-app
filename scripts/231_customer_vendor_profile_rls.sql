-- Customer vendor profile: allow approved vendors to update their own org vendor application
-- and to read vendor types for the business-type dropdown.
-- Run in Supabase SQL Editor after 079_vendor_portal_rls.sql / 074_vendor_hub_vendor_types.sql.

DROP POLICY IF EXISTS "Vendors can update own vendor applications" ON public.applications;
CREATE POLICY "Vendors can update own vendor applications"
  ON public.applications FOR UPDATE
  USING (
    module_owner = 'vendor_hub'
    AND application_type = 'vendor'
    AND contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    module_owner = 'vendor_hub'
    AND application_type = 'vendor'
    AND contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can view org vendor types" ON public.vendor_hub_vendor_types;
CREATE POLICY "Vendors can view org vendor types"
  ON public.vendor_hub_vendor_types FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );
