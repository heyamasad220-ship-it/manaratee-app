-- Fix infinite RLS recursion between vendor_hub_announcements and
-- vendor_hub_announcement_recipients (error 42P17).
-- Run in Supabase SQL Editor after 083_vendor_hub_announcements.sql.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.vendor_hub_user_can_manage_announcement(
  p_announcement_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_hub_announcements a
    INNER JOIN public.organization_members om
      ON om.organization_id = a.organization_id
    WHERE a.id = p_announcement_id
      AND om.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.vendor_hub_user_is_announcement_recipient(
  p_announcement_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_hub_announcement_recipients r
    INNER JOIN public.contacts c ON c.id = r.contact_id
    WHERE r.announcement_id = p_announcement_id
      AND c.auth_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.vendor_hub_user_can_manage_announcement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_hub_user_can_manage_announcement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_hub_user_can_manage_announcement(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.vendor_hub_user_is_announcement_recipient(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_hub_user_is_announcement_recipient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_hub_user_is_announcement_recipient(uuid) TO service_role;

COMMENT ON FUNCTION public.vendor_hub_user_can_manage_announcement IS
  'SECURITY DEFINER helper for announcement recipient RLS — avoids recursion into vendor_hub_announcements policies.';

COMMENT ON FUNCTION public.vendor_hub_user_is_announcement_recipient IS
  'SECURITY DEFINER helper for announcement SELECT RLS — avoids recursion into vendor_hub_announcement_recipients policies.';

-- Staff manage announcements (org membership only — no recipients subquery)
DROP POLICY IF EXISTS "Org members manage vendor hub announcements"
  ON public.vendor_hub_announcements;
CREATE POLICY "Org members manage vendor hub announcements"
  ON public.vendor_hub_announcements FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Vendors read announcements sent to them (helper bypasses recipients RLS recursion)
DROP POLICY IF EXISTS "Vendors can view announcements sent to them"
  ON public.vendor_hub_announcements;
CREATE POLICY "Vendors can view announcements sent to them"
  ON public.vendor_hub_announcements FOR SELECT
  USING (public.vendor_hub_user_is_announcement_recipient(id));

-- Staff manage recipients via helper (bypasses announcements RLS recursion)
DROP POLICY IF EXISTS "Org members manage vendor announcement recipients"
  ON public.vendor_hub_announcement_recipients;
CREATE POLICY "Org members manage vendor announcement recipients"
  ON public.vendor_hub_announcement_recipients FOR ALL
  USING (public.vendor_hub_user_can_manage_announcement(announcement_id))
  WITH CHECK (public.vendor_hub_user_can_manage_announcement(announcement_id));

-- Vendor self-access on recipient rows (contact link only — no announcements subquery)
DROP POLICY IF EXISTS "Vendors can view own announcement recipients"
  ON public.vendor_hub_announcement_recipients;
CREATE POLICY "Vendors can view own announcement recipients"
  ON public.vendor_hub_announcement_recipients FOR SELECT
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can update own announcement read status"
  ON public.vendor_hub_announcement_recipients;
CREATE POLICY "Vendors can update own announcement read status"
  ON public.vendor_hub_announcement_recipients FOR UPDATE
  USING (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    contact_id IN (
      SELECT id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );
