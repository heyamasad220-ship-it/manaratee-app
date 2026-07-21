-- Ensure departments can be managed by active organization members.
-- Fixes "Failed to create department" when legacy/missing INSERT RLS blocks writes.
-- Safe to re-run.

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view departments" ON public.departments;
DROP POLICY IF EXISTS "Organization members can insert departments" ON public.departments;
DROP POLICY IF EXISTS "Organization members can update departments" ON public.departments;
DROP POLICY IF EXISTS "Organization members can delete departments" ON public.departments;
DROP POLICY IF EXISTS "Organization members can manage departments" ON public.departments;

CREATE POLICY "Organization members can manage departments"
ON public.departments FOR ALL
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND COALESCE(status, 'active') = 'active'
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND COALESCE(status, 'active') = 'active'
  )
);
