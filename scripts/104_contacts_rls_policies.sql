-- Contacts table RLS policies (M2 / CR-2). Additive — open policies remain until M4.
-- Run after 103_contacts_rls_support_helpers.sql
-- Safe to re-run.

DROP POLICY IF EXISTS "Staff view org contacts" ON public.contacts;
CREATE POLICY "Staff view org contacts"
  ON public.contacts FOR SELECT
  USING (public.auth_user_can_view_contacts(organization_id));

DROP POLICY IF EXISTS "Staff insert org contacts" ON public.contacts;
CREATE POLICY "Staff insert org contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff update org contacts" ON public.contacts;
CREATE POLICY "Staff update org contacts"
  ON public.contacts FOR UPDATE
  USING (public.auth_user_can_manage_contacts(organization_id))
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff delete org contacts" ON public.contacts;
CREATE POLICY "Staff delete org contacts"
  ON public.contacts FOR DELETE
  USING (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Customers view own contacts" ON public.contacts;
CREATE POLICY "Customers view own contacts"
  ON public.contacts FOR SELECT
  USING (id IN (SELECT public.auth_user_contact_ids()));

DROP POLICY IF EXISTS "Customers view family contacts" ON public.contacts;
CREATE POLICY "Customers view family contacts"
  ON public.contacts FOR SELECT
  USING (public.auth_user_can_view_family_contact(organization_id, id));

DROP POLICY IF EXISTS "Customers update own contacts" ON public.contacts;
CREATE POLICY "Customers update own contacts"
  ON public.contacts FOR UPDATE
  USING (id IN (SELECT public.auth_user_contact_ids()))
  WITH CHECK (id IN (SELECT public.auth_user_contact_ids()));
