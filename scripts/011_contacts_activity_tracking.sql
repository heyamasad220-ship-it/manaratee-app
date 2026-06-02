-- Contact list sorting / activity tracking for CRM-style contacts page
-- Run after 010_hr_teams.sql

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

UPDATE public.contacts
SET
  updated_at = COALESCE(updated_at, created_at, NOW()),
  last_activity_at = COALESCE(last_activity_at, created_at)
WHERE last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_org_last_activity_idx
  ON public.contacts (organization_id, last_activity_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS contacts_org_updated_at_idx
  ON public.contacts (organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS contacts_org_full_name_idx
  ON public.contacts (organization_id, full_name);

CREATE INDEX IF NOT EXISTS contacts_org_email_idx
  ON public.contacts (organization_id, email);

DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
