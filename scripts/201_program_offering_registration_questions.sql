-- Custom registration questions per offering (photo consent, allergies, etc.).
-- Run in Supabase SQL editor after review.

CREATE TABLE IF NOT EXISTS public.program_offering_registration_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.program_offerings(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'yes_no'
    CHECK (question_type IN ('yes_no', 'text', 'textarea')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS program_offering_registration_questions_offering_idx
  ON public.program_offering_registration_questions(organization_id, offering_id, sort_order);

ALTER TABLE public.program_offering_registration_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage offering registration questions"
  ON public.program_offering_registration_questions;
CREATE POLICY "Org members manage offering registration questions"
  ON public.program_offering_registration_questions FOR ALL
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

DROP POLICY IF EXISTS "Customers view active offering registration questions"
  ON public.program_offering_registration_questions;
CREATE POLICY "Customers view active offering registration questions"
  ON public.program_offering_registration_questions FOR SELECT
  USING (
    is_active = true
    AND organization_id IN (
      SELECT organization_id FROM public.contacts WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.program_offering_registration_questions IS
  'Staff-configured registration questions (consent, allergies, custom) per offering.';
