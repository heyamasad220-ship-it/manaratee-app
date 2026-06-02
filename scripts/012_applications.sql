-- Unified Applications engine
-- Run after 011_contacts_activity_tracking.sql

-- Extensible application type definitions (seeded; orgs can add custom types later)
CREATE TABLE IF NOT EXISTS public.application_type_definitions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  module_owner TEXT NOT NULL
    CHECK (module_owner IN ('hr', 'vendor_hub', 'programs')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.application_type_definitions (id, label, module_owner, description, sort_order)
VALUES
  ('volunteer', 'Volunteer Application', 'hr', 'Apply to volunteer with the organization', 10),
  ('employment', 'Employment Application', 'hr', 'Apply for employment', 20),
  ('committee_member', 'Committee Member Application', 'hr', 'Apply to serve on a committee', 30),
  ('vendor', 'Vendor Application', 'vendor_hub', 'Apply to participate as a vendor', 40),
  ('financial_aid', 'Financial Aid Application', 'programs', 'Apply for program financial assistance', 50),
  ('childcare_provider', 'Childcare Provider Application', 'hr', 'Apply to provide childcare services', 60)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  module_owner = EXCLUDED.module_owner,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_type TEXT NOT NULL REFERENCES public.application_type_definitions(id),
  module_owner TEXT NOT NULL
    CHECK (module_owner IN ('hr', 'vendor_hub', 'programs')),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'pending_review', 'approved', 'rejected', 'withdrawn')),
  form_data JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  review_notes TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate legacy columns if table existed with older shape
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'applications'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'email'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'applicant_email'
    ) THEN
      ALTER TABLE public.applications RENAME COLUMN email TO applicant_email;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'phone'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'applicant_phone'
    ) THEN
      ALTER TABLE public.applications RENAME COLUMN phone TO applicant_phone;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'module_owner'
    ) THEN
      ALTER TABLE public.applications ADD COLUMN module_owner TEXT;
      UPDATE public.applications a
      SET module_owner = d.module_owner
      FROM public.application_type_definitions d
      WHERE a.application_type = d.id;
      UPDATE public.applications SET module_owner = 'hr' WHERE module_owner IS NULL;
      ALTER TABLE public.applications ALTER COLUMN module_owner SET NOT NULL;
      ALTER TABLE public.applications ADD CONSTRAINT applications_module_owner_check
        CHECK (module_owner IN ('hr', 'vendor_hub', 'programs'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'contact_id'
    ) THEN
      ALTER TABLE public.applications ADD COLUMN contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'form_data'
    ) THEN
      ALTER TABLE public.applications ADD COLUMN form_data JSONB NOT NULL DEFAULT '{}';
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'details'
      ) THEN
        UPDATE public.applications
        SET form_data = jsonb_build_object('summary', details)
        WHERE details IS NOT NULL AND details <> '';
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'notes'
    ) THEN
      ALTER TABLE public.applications ADD COLUMN notes TEXT;
    END IF;
  END IF;
END $$;

-- Normalize legacy status values (safe if already migrated)
UPDATE public.applications SET status = 'pending_review' WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.application_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('submit', 'review', 'approve', 'reject', 'withdraw', 'note', 'status_change')),
  previous_status TEXT,
  new_status TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS applications_organization_id_idx
  ON public.applications(organization_id);

CREATE INDEX IF NOT EXISTS applications_contact_id_idx
  ON public.applications(contact_id);

CREATE INDEX IF NOT EXISTS applications_type_idx
  ON public.applications(organization_id, application_type);

CREATE INDEX IF NOT EXISTS applications_status_idx
  ON public.applications(organization_id, status);

CREATE INDEX IF NOT EXISTS applications_module_owner_idx
  ON public.applications(organization_id, module_owner);

CREATE INDEX IF NOT EXISTS applications_submitted_at_idx
  ON public.applications(organization_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS application_history_application_id_idx
  ON public.application_history(application_id);

CREATE INDEX IF NOT EXISTS application_documents_application_id_idx
  ON public.application_documents(application_id);

CREATE OR REPLACE FUNCTION public.update_applications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_updated_at ON public.applications;
CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_applications_updated_at();

DROP TRIGGER IF EXISTS application_type_definitions_updated_at ON public.application_type_definitions;
CREATE TRIGGER application_type_definitions_updated_at
  BEFORE UPDATE ON public.application_type_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_applications_updated_at();

ALTER TABLE public.application_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view application type definitions" ON public.application_type_definitions;
CREATE POLICY "Anyone can view application type definitions"
ON public.application_type_definitions
FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Organization members can view applications" ON public.applications;
CREATE POLICY "Organization members can view applications"
ON public.applications
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can insert applications" ON public.applications;
CREATE POLICY "Organization members can insert applications"
ON public.applications
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can update applications" ON public.applications;
CREATE POLICY "Organization members can update applications"
ON public.applications
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can view application history" ON public.application_history;
CREATE POLICY "Organization members can view application history"
ON public.application_history
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can insert application history" ON public.application_history;
CREATE POLICY "Organization members can insert application history"
ON public.application_history
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can view application documents" ON public.application_documents;
CREATE POLICY "Organization members can view application documents"
ON public.application_documents
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can manage application documents" ON public.application_documents;
CREATE POLICY "Organization members can manage application documents"
ON public.application_documents
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Keep childcare provider owned by HR
UPDATE public.application_type_definitions
SET module_owner = 'hr'
WHERE id = 'childcare_provider';

UPDATE public.applications
SET module_owner = 'hr'
WHERE application_type = 'childcare_provider';

-- Applications navigation is scoped under HR, Vendor Hub, and Programs in the app.
-- No separate modules row is required.
