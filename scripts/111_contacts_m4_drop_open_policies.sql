-- M4: Drop legacy open contacts / contact_roles policies (Hybrid C→B cutover).
-- Run ONLY after G6 soak + CR-8 GREEN on staging.
-- Run after 110_contacts_membership_permission_seeds.sql
-- Safe to re-run.

-- Live defects from H-0.2 (names may vary; IF EXISTS guards each drop)
DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
DROP POLICY IF EXISTS "contact_roles_select_policy" ON public.contact_roles;
DROP POLICY IF EXISTS "contact_roles_insert_policy" ON public.contact_roles;

-- Redundant profiles-based org read (H-0.2) — remove if present
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON public.contacts;
DROP POLICY IF EXISTS "Org members can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Organization members can view contacts" ON public.contacts;

COMMENT ON TABLE public.contacts IS
  'CRM identity table — RLS: staff (contacts.view/manage), customer self/family row policies (post-M4).';
