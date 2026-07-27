-- Restore Finance module home route (Transactions) after sidebar return.
-- Safe to re-run. Depends on scripts/187_finance_module_and_payroll_paid.sql.

UPDATE public.modules
SET
  route = '/finance/transactions',
  description = 'Org payment transactions, payroll queue, and financial assistance',
  updated_at = NOW()
WHERE slug = 'finance';

-- Ensure Finance is enabled for every organization that has the module catalog row.
INSERT INTO public.organization_modules (organization_id, module_id, enabled, created_at, updated_at)
SELECT o.id, m.id, true, NOW(), NOW()
FROM public.organizations o
CROSS JOIN public.modules m
WHERE m.slug = 'finance'
  AND NOT EXISTS (
    SELECT 1
    FROM public.organization_modules om
    WHERE om.organization_id = o.id
      AND om.module_id = m.id
  );

UPDATE public.organization_modules om
SET enabled = true, updated_at = NOW()
FROM public.modules m
WHERE m.slug = 'finance'
  AND om.module_id = m.id
  AND om.enabled IS DISTINCT FROM true;
