-- Remove customer as a contact role (customer = transactional activity, not a role)
-- Run after 007_contact_roles_unification.sql

-- Drop legacy customer role rows (data preserved on contacts; activity inferred from transactions)
DELETE FROM public.contact_roles
WHERE role = 'customer';

-- Update role check constraint
ALTER TABLE public.contact_roles
  DROP CONSTRAINT IF EXISTS contact_roles_role_check;

ALTER TABLE public.contact_roles
  ADD CONSTRAINT contact_roles_role_check
  CHECK (role IN (
    'donor',
    'volunteer',
    'employee',
    'member',
    'vendor',
    'service_provider'
  ));

-- Optional: contact_activities ledger for Layer 3 (extensible activity tracking)
CREATE TABLE IF NOT EXISTS public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  reference_table TEXT,
  reference_id UUID,
  title TEXT NOT NULL,
  subtitle TEXT,
  activity_date TIMESTAMPTZ,
  amount NUMERIC(12, 2),
  status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_activities_contact_id_idx
  ON public.contact_activities(contact_id);

CREATE INDEX IF NOT EXISTS contact_activities_organization_id_idx
  ON public.contact_activities(organization_id);

CREATE INDEX IF NOT EXISTS contact_activities_module_type_idx
  ON public.contact_activities(organization_id, module, activity_type);

ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view contact activities"
ON public.contact_activities
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can manage contact activities"
ON public.contact_activities
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS contact_activities_updated_at ON public.contact_activities;
CREATE TRIGGER contact_activities_updated_at
  BEFORE UPDATE ON public.contact_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
