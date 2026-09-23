-- Add Ice Cream to the vendor-type catalog (what the vendor sells, not the booth).
-- Safe to re-run.

INSERT INTO public.vendor_hub_vendor_types (organization_id, name, slug, sort_order, is_active)
SELECT o.id, 'Ice Cream', 'ice-cream', 25, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vendor_hub_vendor_types existing
  WHERE existing.organization_id = o.id
    AND existing.slug = 'ice-cream'
);
