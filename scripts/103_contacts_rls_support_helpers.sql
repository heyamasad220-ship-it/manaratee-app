-- Contacts RLS support helpers (M2a family visibility + M1b affiliation sync gate).
-- Run after 102_contacts_rls_helpers.sql
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Family contact visibility (customer row policy support)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_can_view_family_contact(
  p_org_id uuid,
  p_contact_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts registrant
    INNER JOIN public.person_relationships pr
      ON pr.organization_id = p_org_id
     AND pr.person_id = registrant.person_id
    INNER JOIN public.contacts family
      ON family.organization_id = p_org_id
     AND family.id = p_contact_id
     AND family.person_id = pr.related_person_id
    WHERE registrant.organization_id = p_org_id
      AND registrant.auth_user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.auth_user_can_view_family_contact IS
  'RLS helper: true when the contact is a family member linked to the auth user registrant person in the org.';

-- ---------------------------------------------------------------------------
-- Gate for derived affiliation sync (M6 definer RPCs)
-- ---------------------------------------------------------------------------

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
        OR public.auth_user_has_donation_permission(p_org_id, 'donations.view')
        OR public.auth_user_has_donation_permission(p_org_id, 'donations.manage')
      )
    );
$$;

COMMENT ON FUNCTION public.auth_user_may_sync_derived_affiliations IS
  'Gate for sync_contact_affiliations: CRM manage, customer self/family, or module staff with org membership.';

-- Module contact create gate (find_or_create / ensure_contact_for_person)
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
      )
    );
$$;

COMMENT ON FUNCTION public.auth_user_may_create_contact_via_module IS
  'Gate for module-triggered contact creation RPCs when caller lacks contacts.manage.';

CREATE OR REPLACE FUNCTION public.auth_user_may_ensure_contact_for_person(
  p_org_id uuid,
  p_person_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_user_can_manage_contacts(p_org_id)
    OR EXISTS (
      SELECT 1
      FROM public.contacts registrant
      INNER JOIN public.person_relationships pr
        ON pr.organization_id = p_org_id
       AND pr.person_id = registrant.person_id
       AND pr.related_person_id = p_person_id
      WHERE registrant.organization_id = p_org_id
        AND registrant.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.contacts c
      WHERE c.organization_id = p_org_id
        AND c.person_id = p_person_id
        AND c.auth_user_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.auth_user_may_ensure_contact_for_person IS
  'Gate for ensure_contact_for_person: CRM manage, customer self, or family member person.';
