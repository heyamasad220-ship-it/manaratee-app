-- Speed up vendor_hub_events RLS after large participation/payment imports.
-- The old SELECT policy used IN (SELECT …) over participant/payment tables and
-- was evaluated for every staff query (permissive policies are OR'd), causing
-- statement timeouts (e.g. ensureBazaarShareToken).
--
-- Run in Supabase SQL Editor after 079 / 228.
-- Safe to re-run.

CREATE INDEX IF NOT EXISTS contacts_auth_user_id_idx
  ON public.contacts (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS vendor_hub_participant_status_contact_event_idx
  ON public.vendor_hub_participant_status (contact_id, vendor_hub_event_id);

CREATE INDEX IF NOT EXISTS vendor_hub_booth_assignments_contact_event_idx
  ON public.vendor_hub_booth_assignments (contact_id, event_id);

CREATE INDEX IF NOT EXISTS vendor_hub_payments_contact_event_idx
  ON public.vendor_hub_payments (contact_id, event_id);

CREATE OR REPLACE FUNCTION public.vendor_hub_auth_user_related_to_event(
  p_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.auth_user_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1
          FROM public.vendor_hub_participant_status ps
          WHERE ps.contact_id = c.id
            AND ps.vendor_hub_event_id = p_event_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.vendor_hub_booth_assignments ba
          WHERE ba.contact_id = c.id
            AND ba.event_id = p_event_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.vendor_hub_payments p
          WHERE p.contact_id = c.id
            AND p.event_id = p_event_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.vendor_hub_auth_user_related_to_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_hub_auth_user_related_to_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_hub_auth_user_related_to_event(uuid) TO service_role;

COMMENT ON FUNCTION public.vendor_hub_auth_user_related_to_event IS
  'SECURITY DEFINER: fast contact-scoped check for vendor SELECT on vendor_hub_events (avoids slow permissive IN-subquery RLS).';

DROP POLICY IF EXISTS "Vendors can view related bazaar events" ON public.vendor_hub_events;
CREATE POLICY "Vendors can view related bazaar events"
  ON public.vendor_hub_events FOR SELECT
  USING (
    calendar_status IN ('community_visible', 'published')
    OR public.vendor_hub_auth_user_related_to_event(id)
  );
