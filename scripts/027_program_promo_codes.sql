-- Program-specific promo / discount codes
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'amount')),
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  starts_at DATE,
  expires_at DATE,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS discount_codes_program_id_idx
  ON public.discount_codes(program_id);

CREATE INDEX IF NOT EXISTS discount_codes_organization_id_idx
  ON public.discount_codes(organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_program_code_idx
  ON public.discount_codes (program_id, lower(code))
  WHERE program_id IS NOT NULL;

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view discount codes" ON public.discount_codes;
CREATE POLICY "Organization members can view discount codes"
ON public.discount_codes
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can insert discount codes" ON public.discount_codes;
CREATE POLICY "Organization members can insert discount codes"
ON public.discount_codes
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organization members can update discount codes" ON public.discount_codes;
CREATE POLICY "Organization members can update discount codes"
ON public.discount_codes
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

DROP POLICY IF EXISTS "Organization members can delete discount codes" ON public.discount_codes;
CREATE POLICY "Organization members can delete discount codes"
ON public.discount_codes
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);
