-- Administration (workforce) is a Programs / Event Management capability,
-- not a core module for every tenant. Fund Development-only orgs do not get it.
-- Safe to re-run.

UPDATE public.modules
SET
  is_core = false,
  description = 'Staff directory, departments, and people operations (included with Programs or Event Management)'
WHERE slug IN ('workforce', 'hr');

UPDATE public.modules
SET included_capability_slugs = (
  SELECT ARRAY(
    SELECT DISTINCT slug
    FROM unnest(
      COALESCE(included_capability_slugs, '{}'::text[]) || ARRAY['workforce']
    ) AS slug
  )
)
WHERE slug IN ('event-management', 'programs');

-- Enable Administration when Programs or Event Management is on.
UPDATE public.organization_modules om
SET
  enabled = true,
  enabled_at = COALESCE(om.enabled_at, now()),
  disabled_at = NULL,
  enabled_by_plan = false,
  manually_overridden = false
FROM public.modules workforce
WHERE om.module_id = workforce.id
  AND workforce.slug = 'workforce'
  AND EXISTS (
    SELECT 1
    FROM public.organization_modules product_om
    INNER JOIN public.modules product ON product.id = product_om.module_id
    WHERE product_om.organization_id = om.organization_id
      AND product_om.enabled = true
      AND product.slug IN ('programs', 'event-management')
  );

-- Hide Administration for tenants that only have Fund Development (or other
-- products that do not include this capability).
UPDATE public.organization_modules om
SET
  enabled = false,
  enabled_at = NULL,
  disabled_at = now(),
  enabled_by_plan = false,
  manually_overridden = false
FROM public.modules workforce
WHERE om.module_id = workforce.id
  AND workforce.slug IN ('workforce', 'hr')
  AND om.enabled = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.organization_modules product_om
    INNER JOIN public.modules product ON product.id = product_om.module_id
    WHERE product_om.organization_id = om.organization_id
      AND product_om.enabled = true
      AND product.slug IN ('programs', 'event-management')
  );
