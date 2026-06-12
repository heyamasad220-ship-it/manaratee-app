-- Platform admin temporary org access (support / impersonation)
-- Run in Supabase SQL Editor after 085_vendor_hub_flyer_and_share.sql

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS platform_support_access BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS organization_members_platform_support_idx
  ON public.organization_members (organization_id, user_id)
  WHERE platform_support_access = true;

CREATE TABLE IF NOT EXISTS public.platform_admin_org_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('enter', 'exit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_admin_org_access_log_org_idx
  ON public.platform_admin_org_access_log (organization_id, created_at DESC);

ALTER TABLE public.platform_admin_org_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read org access log"
  ON public.platform_admin_org_access_log;
CREATE POLICY "Platform admins read org access log"
  ON public.platform_admin_org_access_log FOR SELECT
  USING (
    platform_admin_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

COMMENT ON COLUMN public.organization_members.platform_support_access IS
  'True when membership was created for platform admin support access (hidden from org member lists).';

COMMENT ON TABLE public.platform_admin_org_access_log IS
  'Audit trail when platform admins enter or exit an organization dashboard.';
