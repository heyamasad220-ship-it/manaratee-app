-- Contacts RLS helpers (M1 — staff-only can_view; no policy changes).
-- Run after 101_contact_participation_roles.sql
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Permission helpers (mirror 095 donations pattern)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_has_contact_permission(
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

CREATE OR REPLACE FUNCTION public.auth_user_can_view_contacts(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_has_contact_permission(p_org_id, 'contacts.view')
    OR public.auth_user_has_contact_permission(p_org_id, 'contacts.manage');
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can_manage_contacts(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_has_contact_permission(p_org_id, 'contacts.manage');
$$;

COMMENT ON FUNCTION public.auth_user_has_contact_permission IS
  'RLS helper: true when auth user has the given contacts permission key in the org (or is owner).';

COMMENT ON FUNCTION public.auth_user_can_view_contacts IS
  'RLS helper: staff-only org contact read — contacts.view or contacts.manage (or owner). Customer access uses row policies.';

COMMENT ON FUNCTION public.auth_user_can_manage_contacts IS
  'RLS helper: true when auth user has contacts.manage in the org (or is owner).';
