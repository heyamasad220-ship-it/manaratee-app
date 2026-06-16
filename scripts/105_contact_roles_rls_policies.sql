-- contact_roles table RLS policies (M2 / CR-3). Additive — open policies remain until M4.
-- Run after 104_contacts_rls_policies.sql
-- Safe to re-run.

DROP POLICY IF EXISTS "Staff view org contact roles" ON public.contact_roles;
CREATE POLICY "Staff view org contact roles"
  ON public.contact_roles FOR SELECT
  USING (public.auth_user_can_view_contacts(organization_id));

DROP POLICY IF EXISTS "Staff insert org contact roles" ON public.contact_roles;
CREATE POLICY "Staff insert org contact roles"
  ON public.contact_roles FOR INSERT
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff update org contact roles" ON public.contact_roles;
CREATE POLICY "Staff update org contact roles"
  ON public.contact_roles FOR UPDATE
  USING (public.auth_user_can_manage_contacts(organization_id))
  WITH CHECK (public.auth_user_can_manage_contacts(organization_id));

DROP POLICY IF EXISTS "Staff delete org contact roles" ON public.contact_roles;
CREATE POLICY "Staff delete org contact roles"
  ON public.contact_roles FOR DELETE
  USING (public.auth_user_can_manage_contacts(organization_id));
