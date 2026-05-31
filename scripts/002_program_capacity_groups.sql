-- Program capacity by grade level groups
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.program_capacity_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_levels TEXT[] NOT NULL DEFAULT '{}',
  genders TEXT[] NOT NULL DEFAULT '{}',
  capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  enrolled INTEGER NOT NULL DEFAULT 0 CHECK (enrolled >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_capacity_groups_program_id_idx
  ON public.program_capacity_groups(program_id);

CREATE INDEX IF NOT EXISTS program_capacity_groups_organization_id_idx
  ON public.program_capacity_groups(organization_id);

ALTER TABLE public.program_capacity_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view program capacity groups"
ON public.program_capacity_groups
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can insert program capacity groups"
ON public.program_capacity_groups
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update program capacity groups"
ON public.program_capacity_groups
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

CREATE POLICY "Organization members can delete program capacity groups"
ON public.program_capacity_groups
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);
