-- Super Admin + Admin are required organization_roles for every tenant.
-- Also keep admin@manaratee.com as a platform admin (not an org staff member).
-- Safe to re-run.

-- 1) Platform admin account
DO $$
DECLARE
  v_user_id uuid;
  v_has_role boolean;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'admin@manaratee.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'admin@manaratee.com was not found in auth.users. Create the Auth user, then re-run this script.';
    RETURN;
  END IF;

  UPDATE public.profiles
  SET is_platform_admin = true
  WHERE id = v_user_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_admins'
      AND column_name = 'role'
  ) INTO v_has_role;

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = v_user_id
  ) THEN
    IF v_has_role THEN
      INSERT INTO public.platform_admins (user_id, role)
      VALUES (v_user_id, 'owner');
    ELSE
      INSERT INTO public.platform_admins (user_id)
      VALUES (v_user_id);
    END IF;
  END IF;
END $$;

-- 2) Seed Super Admin and Admin roles for every organization
INSERT INTO public.organization_roles (organization_id, name, description, is_system_role)
SELECT
  o.id,
  seed.name,
  seed.description,
  true
FROM public.organizations o
CROSS JOIN (
  VALUES
    (
      'Super Admin',
      'First organization role. Manages users, roles, billing, and all enabled modules. Invites Admins.'
    ),
    (
      'Admin',
      'Organization staff administrator. Invited by a Super Admin to help run the organization.'
    )
) AS seed(name, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organization_roles r
  WHERE r.organization_id = o.id
    AND lower(r.name) = lower(seed.name)
);

UPDATE public.organization_roles
SET is_system_role = true
WHERE lower(name) IN ('super admin', 'admin')
  AND coalesce(is_system_role, false) = false;

-- 3) Full permission set for Super Admin and Admin (insert missing only)
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, keys.permission_key, true
FROM public.organization_roles r
CROSS JOIN (
  VALUES
    ('settings.users.view'),
    ('settings.users.manage'),
    ('settings.roles.view'),
    ('settings.roles.manage'),
    ('applications.view'),
    ('applications.manage'),
    ('programs.view'),
    ('programs.manage'),
    ('staff.view'),
    ('staff.manage'),
    ('donations.view'),
    ('donations.manage'),
    ('donations.campaigns.manage'),
    ('donations.prospects.manage'),
    ('donations.reports.manage'),
    ('reports.view'),
    ('events.view'),
    ('events.checkin'),
    ('events.manage'),
    ('ticketing.view'),
    ('ticketing.manage'),
    ('membership.view'),
    ('membership.manage'),
    ('bookings.view'),
    ('bookings.manage'),
    ('spaces.view'),
    ('spaces.manage'),
    ('finance.view'),
    ('finance.manage'),
    ('vendor_hub.view'),
    ('vendor_hub.manage'),
    ('contacts.view'),
    ('contacts.manage')
) AS keys(permission_key)
WHERE lower(r.name) IN ('super admin', 'admin')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- 4) Attach existing members that only have a system role string
UPDATE public.organization_members om
SET role_id = r.id
FROM public.organization_roles r
WHERE om.organization_id = r.organization_id
  AND om.role_id IS NULL
  AND lower(r.name) = 'super admin'
  AND om.role IN ('super_admin', 'owner');

UPDATE public.organization_members om
SET role_id = r.id
FROM public.organization_roles r
WHERE om.organization_id = r.organization_id
  AND om.role_id IS NULL
  AND lower(r.name) = 'admin'
  AND om.role = 'admin';

-- 5) RLS: Super Admin / Admin system members and platform admins can manage roles
CREATE OR REPLACE FUNCTION public.can_manage_organization_roles(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_platform_admin IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = p_organization_id
        AND om.user_id = auth.uid()
        AND coalesce(om.status, 'active') = 'active'
        AND om.role IN ('super_admin', 'admin', 'owner')
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.role_permissions rp
        ON rp.role_id = om.role_id
       AND rp.organization_id = om.organization_id
      WHERE om.organization_id = p_organization_id
        AND om.user_id = auth.uid()
        AND coalesce(om.status, 'active') = 'active'
        AND rp.permission_key = 'settings.roles.manage'
        AND rp.enabled IS TRUE
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_organization_roles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_organization_roles(uuid) TO authenticated;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_roles'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_roles', pol.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS organization_roles_insert_managers ON public.organization_roles;
DROP POLICY IF EXISTS organization_roles_update_managers ON public.organization_roles;
DROP POLICY IF EXISTS organization_roles_delete_managers ON public.organization_roles;

CREATE POLICY organization_roles_insert_managers
  ON public.organization_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_organization_roles(organization_id));

CREATE POLICY organization_roles_update_managers
  ON public.organization_roles
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_organization_roles(organization_id))
  WITH CHECK (public.can_manage_organization_roles(organization_id));

CREATE POLICY organization_roles_delete_managers
  ON public.organization_roles
  FOR DELETE
  TO authenticated
  USING (public.can_manage_organization_roles(organization_id));
