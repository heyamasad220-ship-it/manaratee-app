-- Drop residual profiles-based contacts read policy (post-M4 hardening).
-- Admin/Super Admin access must flow through contacts.view / contacts.manage only.
-- Org owners retain access via auth_user_is_org_owner() in permission helpers.
-- Run after 111_contacts_m4_drop_open_policies.sql
-- Safe to re-run.

DROP POLICY IF EXISTS "Org admins can view organization contacts" ON public.contacts;

COMMENT ON TABLE public.contacts IS
  'CRM identity table — RLS: staff (contacts.view/manage via helpers), customer self/family row policies (post-M4, post-113).';
