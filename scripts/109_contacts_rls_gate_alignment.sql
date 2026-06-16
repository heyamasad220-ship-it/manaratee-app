-- M6b: Ticketing + membership RPC gate alignment.
-- Run after 108_contacts_affiliation_sync_rpcs.sql
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.auth_user_may_sync_derived_affiliations(
  p_org_id uuid,
  p_contact_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_can_manage_contacts(p_org_id)
    OR p_contact_id IN (SELECT public.auth_user_contact_ids())
    OR public.auth_user_can_view_family_contact(p_org_id, p_contact_id)
    OR (
      public.auth_user_is_active_org_member(p_org_id)
      AND EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = p_contact_id AND c.organization_id = p_org_id
      )
      AND (
        public.auth_user_has_contact_permission(p_org_id, 'donations.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'donations.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'bookings.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'bookings.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'staff.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'staff.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'programs.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'programs.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'applications.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'applications.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'vendor_hub.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'vendor_hub.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'events.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'events.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'ticketing.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'ticketing.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'membership.view')
        OR public.auth_user_has_contact_permission(p_org_id, 'membership.manage')
        OR public.auth_user_has_donation_permission(p_org_id, 'donations.view')
        OR public.auth_user_has_donation_permission(p_org_id, 'donations.manage')
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_may_create_contact_via_module(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_can_manage_contacts(p_org_id)
    OR (
      public.auth_user_is_active_org_member(p_org_id)
      AND (
        public.auth_user_has_contact_permission(p_org_id, 'staff.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'applications.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'programs.manage')
        OR public.auth_user_has_donation_permission(p_org_id, 'donations.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'bookings.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'vendor_hub.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'events.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'ticketing.manage')
        OR public.auth_user_has_contact_permission(p_org_id, 'membership.manage')
      )
    );
$$;

COMMENT ON FUNCTION public.auth_user_may_sync_derived_affiliations IS
  'M6b: sync gate includes events, ticketing, and membership module permissions.';

COMMENT ON FUNCTION public.auth_user_may_create_contact_via_module IS
  'M6b: create gate includes events.manage, ticketing.manage, and membership.manage.';
