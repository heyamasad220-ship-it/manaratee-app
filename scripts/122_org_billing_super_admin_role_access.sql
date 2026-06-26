-- Patch org billing RLS for Super Admin organization role (not only system role super_admin)
-- Run if 121_organization_billing.sql was already applied with the older policies.

CREATE OR REPLACE FUNCTION public.user_can_manage_org_billing(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    LEFT JOIN public.organization_roles r
      ON r.id = om.role_id
     AND r.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_organization_id
      AND (
        om.role IN ('super_admin', 'owner')
        OR lower(trim(coalesce(r.name, ''))) = 'super admin'
      )
  );
$$;

DROP POLICY IF EXISTS organization_payment_methods_select ON public.organization_payment_methods;
DROP POLICY IF EXISTS organization_payment_methods_insert ON public.organization_payment_methods;
DROP POLICY IF EXISTS organization_payment_methods_update ON public.organization_payment_methods;
DROP POLICY IF EXISTS organization_payment_methods_delete ON public.organization_payment_methods;
DROP POLICY IF EXISTS organization_billing_invoices_select ON public.organization_billing_invoices;

CREATE POLICY organization_payment_methods_select ON public.organization_payment_methods
  FOR SELECT TO authenticated
  USING (public.user_can_manage_org_billing(organization_id));

CREATE POLICY organization_payment_methods_insert ON public.organization_payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_manage_org_billing(organization_id));

CREATE POLICY organization_payment_methods_update ON public.organization_payment_methods
  FOR UPDATE TO authenticated
  USING (public.user_can_manage_org_billing(organization_id));

CREATE POLICY organization_payment_methods_delete ON public.organization_payment_methods
  FOR DELETE TO authenticated
  USING (public.user_can_manage_org_billing(organization_id));

CREATE POLICY organization_billing_invoices_select ON public.organization_billing_invoices
  FOR SELECT TO authenticated
  USING (public.user_can_manage_org_billing(organization_id));
