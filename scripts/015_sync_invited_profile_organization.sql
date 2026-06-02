-- Sync profiles.organization_id from organization_members (invited users)
-- Run in Supabase SQL Editor after 014_organization_members_invite_support.sql
--
-- Safe to re-run (idempotent).

-- Align profiles.role check with organization_members system roles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Normalize legacy values before re-adding the check
UPDATE public.profiles
SET role = CASE
  WHEN role IN ('super_admin', 'admin', 'coordinator', 'viewer', 'member', 'owner') THEN role
  WHEN role IN ('staff', 'employee') THEN 'viewer'
  ELSE 'viewer'
END
WHERE role IS NOT NULL
  AND role NOT IN ('super_admin', 'admin', 'coordinator', 'viewer', 'member', 'owner');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (
    role IS NULL
    OR role IN ('super_admin', 'admin', 'coordinator', 'viewer', 'member', 'owner')
  );

-- Backfill organization_id only — do not overwrite existing profile roles
UPDATE public.profiles AS p
SET
  organization_id = om.organization_id,
  updated_at = NOW()
FROM public.organization_members AS om
WHERE om.user_id = p.id
  AND p.organization_id IS NULL;

-- Invited staff: if profile role is NULL, set a safe default from membership
UPDATE public.profiles AS p
SET
  role = CASE
    WHEN om.role IN ('super_admin', 'admin', 'coordinator', 'viewer', 'member', 'owner')
      THEN om.role
    ELSE 'viewer'
  END,
  updated_at = NOW()
FROM public.organization_members AS om
WHERE om.user_id = p.id
  AND p.role IS NULL;

-- New auth users: copy organization_id from invite metadata when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invited_org_id UUID;
BEGIN
  invited_org_id := NULLIF(NEW.raw_user_meta_data ->> 'organization_id', '')::UUID;

  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    organization_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', NULL),
    invited_org_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
