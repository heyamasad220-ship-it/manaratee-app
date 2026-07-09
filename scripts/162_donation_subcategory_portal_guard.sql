-- Block customer portal payments to closed donation funds.
CREATE OR REPLACE FUNCTION public.donation_subcategory_accepts_gifts(p_subcategory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_subcategory_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.donation_subcategories ds
      WHERE ds.id = p_subcategory_id
        AND ds.is_active = true
    );
$$;

DROP POLICY IF EXISTS "Customers insert own portal payments" ON public.payments;

CREATE POLICY "Customers insert own portal payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    contact_id IN (SELECT public.auth_user_contact_ids())
    AND organization_id IN (
      SELECT c.organization_id
      FROM public.contacts c
      WHERE c.id = contact_id
        AND c.auth_user_id = auth.uid()
    )
    AND source_type = 'portal'
    AND public.donation_subcategory_accepts_gifts(subcategory_id)
  );
