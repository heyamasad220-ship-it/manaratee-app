-- Organization admin user support access (view/act on behalf of portal users)
-- Run in Supabase SQL Editor after 086_platform_admin_org_access.sql

CREATE TABLE IF NOT EXISTS public.organization_user_support_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('enter', 'exit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_user_support_log_org_idx
  ON public.organization_user_support_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS organization_user_support_log_actor_idx
  ON public.organization_user_support_log (actor_user_id, created_at DESC);

ALTER TABLE public.organization_user_support_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org staff read user support log"
  ON public.organization_user_support_log;
CREATE POLICY "Org staff read user support log"
  ON public.organization_user_support_log FOR SELECT
  USING (
    actor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_user_support_log.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'super_admin', 'coordinator')
    )
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.organization_user_support_log IS
  'Audit trail when org admins enter or exit customer portal on behalf of a user.';
