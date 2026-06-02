-- Volunteers module tables
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('active', 'inactive', 'pending')),
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  skills TEXT[] NOT NULL DEFAULT '{}',
  availability TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS volunteers_organization_id_idx
  ON public.volunteers(organization_id);

CREATE INDEX IF NOT EXISTS volunteers_status_idx
  ON public.volunteers(organization_id, status);

CREATE TABLE IF NOT EXISTS public.volunteer_sign_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date DATE,
  role TEXT,
  hours_logged NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (hours_logged >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('confirmed', 'pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS volunteer_sign_ups_volunteer_id_idx
  ON public.volunteer_sign_ups(volunteer_id);

CREATE INDEX IF NOT EXISTS volunteer_sign_ups_organization_id_idx
  ON public.volunteer_sign_ups(organization_id);

CREATE TABLE IF NOT EXISTS public.volunteer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  volunteer_id UUID NOT NULL REFERENCES public.volunteers(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date DATE,
  role TEXT,
  hours_worked NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (hours_worked >= 0),
  performance TEXT NOT NULL DEFAULT 'good'
    CHECK (performance IN ('excellent', 'good', 'average', 'poor')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS volunteer_history_volunteer_id_idx
  ON public.volunteer_history(volunteer_id);

CREATE INDEX IF NOT EXISTS volunteer_history_organization_id_idx
  ON public.volunteer_history(organization_id);

ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_sign_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view volunteers"
ON public.volunteers
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can insert volunteers"
ON public.volunteers
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update volunteers"
ON public.volunteers
FOR UPDATE
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

CREATE POLICY "Organization members can delete volunteers"
ON public.volunteers
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can view volunteer sign ups"
ON public.volunteer_sign_ups
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can insert volunteer sign ups"
ON public.volunteer_sign_ups
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update volunteer sign ups"
ON public.volunteer_sign_ups
FOR UPDATE
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

CREATE POLICY "Organization members can delete volunteer sign ups"
ON public.volunteer_sign_ups
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can view volunteer history"
ON public.volunteer_history
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can insert volunteer history"
ON public.volunteer_history
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update volunteer history"
ON public.volunteer_history
FOR UPDATE
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

CREATE POLICY "Organization members can delete volunteer history"
ON public.volunteer_history
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Required by updated_at triggers below. Safe to run if it already exists.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS volunteers_updated_at ON public.volunteers;
CREATE TRIGGER volunteers_updated_at
  BEFORE UPDATE ON public.volunteers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS volunteer_sign_ups_updated_at ON public.volunteer_sign_ups;
CREATE TRIGGER volunteer_sign_ups_updated_at
  BEFORE UPDATE ON public.volunteer_sign_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS volunteer_history_updated_at ON public.volunteer_history;
CREATE TRIGGER volunteer_history_updated_at
  BEFORE UPDATE ON public.volunteer_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
