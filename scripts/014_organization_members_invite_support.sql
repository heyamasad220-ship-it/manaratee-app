-- Organization member invite support
-- Run in Supabase SQL Editor after 013_rename_hr_module.sql
--
-- Fixes invite failures like:
--   organization_members_role_check violated by role = 'member' or 'viewer'
--
-- Safe to re-run (idempotent).

-- Ensure status column exists for active memberships (used by login routing)
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.organization_members
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.organization_members
  ALTER COLUMN status SET DEFAULT 'active';

-- Drop the old check so we can fix existing rows first
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

-- Normalize blank values
UPDATE public.organization_members
SET role = NULL
WHERE role IS NOT NULL AND btrim(role) = '';

-- Fix legacy / invalid role values BEFORE re-adding the constraint
UPDATE public.organization_members
SET role = CASE
  WHEN role IN ('super_admin', 'owner') THEN role
  WHEN role IN ('admin', 'coordinator', 'viewer') THEN role
  WHEN role IN ('member', 'customer', 'staff', 'employee') THEN 'viewer'
  WHEN role IS NULL THEN 'admin'
  ELSE 'admin'
END
WHERE role IS NULL
   OR role NOT IN ('super_admin', 'admin', 'coordinator', 'viewer', 'owner');

-- Re-apply allowed system access roles
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN (
    'super_admin',
    'admin',
    'coordinator',
    'viewer',
    'owner'
  ));

-- Required for invite upsert on (organization_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_organization_user_idx
  ON public.organization_members(organization_id, user_id);

COMMENT ON COLUMN public.organization_members.role IS
  'System access tier (super_admin, admin, coordinator, viewer). Organization permissions use role_id.';
