-- Phase 0 + 1: offerings, contact-based enrollments, registration options, session access
-- Run in Supabase SQL Editor after 015_sync_invited_profile_organization.sql

-- ---------------------------------------------------------------------------
-- 1) program_offerings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  offering_type TEXT NOT NULL DEFAULT 'standard' CHECK (
    offering_type IN ('standard', 'academic_year', 'summer', 'season', 'recurring')
  ),
  start_date DATE,
  end_date DATE,
  enrollment_open_date DATE,
  enrollment_close_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('draft', 'active', 'closed', 'archived')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_offerings_org_program_idx
  ON public.program_offerings(organization_id, program_id);

CREATE UNIQUE INDEX IF NOT EXISTS program_offerings_default_unique
  ON public.program_offerings(organization_id, program_id)
  WHERE is_default = true;

-- Default offering per existing program (copy dates from program row)
INSERT INTO public.program_offerings (
  organization_id,
  program_id,
  name,
  is_default,
  offering_type,
  start_date,
  end_date,
  enrollment_open_date,
  enrollment_close_date,
  status
)
SELECT
  p.organization_id,
  p.id,
  COALESCE(NULLIF(btrim(p.name), ''), 'Program') || ' — Default Offering',
  true,
  'standard',
  p.start_date,
  p.end_date,
  p.enrollment_open_date,
  p.enrollment_close_date,
  CASE
    WHEN p.status IN ('active', 'draft', 'paused', 'archived') THEN
      CASE WHEN p.status = 'draft' THEN 'draft' ELSE 'active' END
    ELSE 'active'
  END
FROM public.programs p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.program_offerings o
  WHERE o.organization_id = p.organization_id
    AND o.program_id = p.id
    AND o.is_default = true
);

-- ---------------------------------------------------------------------------
-- 2) Link sessions to default offering
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_sessions
  ADD COLUMN IF NOT EXISTS offering_id UUID REFERENCES public.program_offerings(id) ON DELETE SET NULL;

UPDATE public.program_sessions AS s
SET offering_id = o.id
FROM public.program_offerings AS o
WHERE s.offering_id IS NULL
  AND s.organization_id = o.organization_id
  AND s.program_id = o.program_id
  AND o.is_default = true;

CREATE INDEX IF NOT EXISTS program_sessions_offering_id_idx
  ON public.program_sessions(organization_id, offering_id);

-- ---------------------------------------------------------------------------
-- 3) program_registration_options (belong to offerings)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_registration_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (
    option_type IN ('full_program', 'selected_sessions', 'single_session', 'drop_in')
  ),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority_rank INTEGER NOT NULL DEFAULT 0,
  available_from DATE,
  available_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_registration_options_offering_idx
  ON public.program_registration_options(organization_id, offering_id);

CREATE UNIQUE INDEX IF NOT EXISTS program_registration_options_unique_type
  ON public.program_registration_options(organization_id, offering_id, option_type);

INSERT INTO public.program_registration_options (
  organization_id, program_id, offering_id, name, option_type, is_active, priority_rank
)
SELECT
  o.organization_id,
  o.program_id,
  o.id,
  'Full Program',
  'full_program',
  true,
  10
FROM public.program_offerings o
JOIN public.programs p ON p.id = o.program_id AND p.organization_id = o.organization_id
WHERE o.is_default = true
  AND COALESCE(p.full_program_registration_enabled, true) = true
ON CONFLICT (organization_id, offering_id, option_type) DO NOTHING;

INSERT INTO public.program_registration_options (
  organization_id, program_id, offering_id, name, option_type, is_active, priority_rank
)
SELECT
  o.organization_id,
  o.program_id,
  o.id,
  'Selected Sessions',
  'selected_sessions',
  true,
  20
FROM public.program_offerings o
JOIN public.programs p ON p.id = o.program_id AND p.organization_id = o.organization_id
WHERE o.is_default = true
  AND COALESCE(p.session_registration_enabled, false) = true
ON CONFLICT (organization_id, offering_id, option_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Contact + registration metadata on program_enrollments
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_enrollments
  ADD COLUMN IF NOT EXISTS offering_id UUID REFERENCES public.program_offerings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registrant_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registration_option_id UUID REFERENCES public.program_registration_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_type TEXT CHECK (
    participant_type IS NULL OR participant_type IN ('adult', 'youth', 'family', 'group')
  ),
  ADD COLUMN IF NOT EXISTS registrant_type TEXT CHECK (
    registrant_type IS NULL OR registrant_type IN ('adult_self', 'guardian', 'organization', 'staff')
  );

CREATE INDEX IF NOT EXISTS program_enrollments_offering_idx
  ON public.program_enrollments(organization_id, offering_id);

CREATE INDEX IF NOT EXISTS program_enrollments_participant_contact_idx
  ON public.program_enrollments(organization_id, participant_contact_id);

CREATE INDEX IF NOT EXISTS program_enrollments_registrant_contact_idx
  ON public.program_enrollments(organization_id, registrant_contact_id);

CREATE INDEX IF NOT EXISTS program_enrollments_payer_contact_idx
  ON public.program_enrollments(organization_id, payer_contact_id);

UPDATE public.program_enrollments AS e
SET offering_id = o.id
FROM public.program_offerings AS o
WHERE e.offering_id IS NULL
  AND e.organization_id = o.organization_id
  AND e.program_id = o.program_id
  AND o.is_default = true;

-- ---------------------------------------------------------------------------
-- 5) program_registration_session_access
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_registration_session_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.program_enrollments(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.program_sessions(id) ON DELETE CASCADE,
  access_status TEXT NOT NULL DEFAULT 'active' CHECK (
    access_status IN ('active', 'cancelled', 'transferred')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, enrollment_id, session_id)
);

CREATE INDEX IF NOT EXISTS program_registration_session_access_enrollment_idx
  ON public.program_registration_session_access(organization_id, enrollment_id);

CREATE INDEX IF NOT EXISTS program_registration_session_access_session_idx
  ON public.program_registration_session_access(organization_id, session_id);

-- Backfill from legacy weeks[]
INSERT INTO public.program_registration_session_access (
  organization_id, enrollment_id, session_id, access_status
)
SELECT
  e.organization_id,
  e.id,
  s.id,
  'active'
FROM public.program_enrollments e
CROSS JOIN LATERAL unnest(COALESCE(e.weeks, '{}'::text[])) AS week_id
JOIN public.program_sessions s
  ON s.id = week_id::uuid
 AND s.organization_id = e.organization_id
 AND s.program_id = e.program_id
ON CONFLICT (organization_id, enrollment_id, session_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_registration_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_registration_session_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage program offerings" ON public.program_offerings;
CREATE POLICY "Org members manage program offerings"
  ON public.program_offerings FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage program registration options" ON public.program_registration_options;
CREATE POLICY "Org members manage program registration options"
  ON public.program_registration_options FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage program registration session access" ON public.program_registration_session_access;
CREATE POLICY "Org members manage program registration session access"
  ON public.program_registration_session_access FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Customer read access for offerings/options/sessions (authenticated users in org)
DROP POLICY IF EXISTS "Org members view program offerings" ON public.program_offerings;
CREATE POLICY "Org members view program offerings"
  ON public.program_offerings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members view program registration options" ON public.program_registration_options;
CREATE POLICY "Org members view program registration options"
  ON public.program_registration_options FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );
