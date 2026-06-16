-- contact_notes table RLS policies (M2 / CR-4). First policies on deny-all table.
-- Run after 105_contact_roles_rls_policies.sql
-- Safe to re-run.

DROP POLICY IF EXISTS "Staff view org contact notes" ON public.contact_notes;
CREATE POLICY "Staff view org contact notes"
  ON public.contact_notes FOR SELECT
  USING (public.auth_user_can_view_contacts(organization_id));

DROP POLICY IF EXISTS "Staff insert org contact notes" ON public.contact_notes;
CREATE POLICY "Staff insert org contact notes"
  ON public.contact_notes FOR INSERT
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff update org contact notes" ON public.contact_notes;
CREATE POLICY "Staff update org contact notes"
  ON public.contact_notes FOR UPDATE
  USING (public.auth_user_can_manage_contacts(organization_id))
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff delete org contact notes" ON public.contact_notes;
CREATE POLICY "Staff delete org contact notes"
  ON public.contact_notes FOR DELETE
  USING (public.auth_user_can_manage_contacts(organization_id));
