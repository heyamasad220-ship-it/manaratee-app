-- Organization audit log for financial and permission changes.
-- Run after 141_drop_payment_import_rows_and_backup_tables.sql

CREATE TABLE IF NOT EXISTS public.organization_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('financial', 'permission')),
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_display_name text,
  target_type text,
  target_id uuid,
  target_label text,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_audit_logs_org_created
  ON public.organization_audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_organization_audit_logs_org_category_created
  ON public.organization_audit_logs (organization_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_organization_audit_logs_org_action
  ON public.organization_audit_logs (organization_id, action);

COMMENT ON TABLE public.organization_audit_logs IS
  'Append-only audit trail for donation ledger changes and org permission/membership changes.';

-- ---------------------------------------------------------------------------
-- RLS: staff read via settings or donations permissions; writes via service role
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_can_view_audit_logs(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_is_org_owner(p_org_id)
    OR public.auth_user_has_contact_permission(p_org_id, 'settings.users.view')
    OR public.auth_user_has_contact_permission(p_org_id, 'settings.roles.view')
    OR public.auth_user_has_donation_permission(p_org_id, 'donations.view')
    OR public.auth_user_has_donation_permission(p_org_id, 'donations.manage');
$$;

ALTER TABLE public.organization_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view organization audit logs" ON public.organization_audit_logs;
CREATE POLICY "Staff view organization audit logs"
  ON public.organization_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.auth_user_can_view_audit_logs(organization_id));

GRANT SELECT ON public.organization_audit_logs TO authenticated;
GRANT ALL ON public.organization_audit_logs TO service_role;
