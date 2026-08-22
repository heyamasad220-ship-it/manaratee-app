-- Hide platform owner / platform admin rows from org staff lists.
-- Safe to re-run. Requires scripts/086_platform_admin_org_access.sql (platform_support_access).

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS platform_support_access BOOLEAN NOT NULL DEFAULT false;

-- 1) Flag every membership that belongs to a platform admin
UPDATE public.organization_members om
SET platform_support_access = true
WHERE coalesce(om.platform_support_access, false) = false
  AND (
    EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = om.user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = om.user_id
        AND p.is_platform_admin IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = om.user_id
        AND lower(u.email) = 'admin@manaratee.com'
    )
  );

-- 2) Convenience view for Table Editor: org people only (not platform support)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'organization_users'
  ) THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.organization_users AS
      SELECT
        om.id,
        om.user_id,
        om.organization_id,
        om.role,
        om.created_at,
        coalesce(p.email, u.email::varchar) AS email
      FROM public.organization_members om
      LEFT JOIN public.profiles p ON p.id = om.user_id
      LEFT JOIN auth.users u ON u.id = om.user_id
      WHERE coalesce(om.platform_support_access, false) = false
    $view$;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not replace public.organization_users (%). Platform support rows are still flagged on organization_members.', SQLERRM;
END $$;
