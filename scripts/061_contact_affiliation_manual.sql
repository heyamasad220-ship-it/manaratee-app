-- Track manual affiliation overrides on contact_roles
-- Run after 060_workforce_module_slug.sql

ALTER TABLE public.contact_roles
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS contact_roles_manual_idx
  ON public.contact_roles (organization_id, contact_id)
  WHERE is_manual = true;

COMMENT ON COLUMN public.contact_roles.is_manual IS
  'When true, affiliation was set by staff override and is not removed by automatic sync (except explicit manual edit).';
