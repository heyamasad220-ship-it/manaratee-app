-- Seed post-event fee add-ons for Venue Rentals → Settings → Add-ons
-- and Financial → Add charge. Safe to re-run.
-- Run after scripts/216_venue_rental_addon_catalog.sql.

INSERT INTO public.rental_addons (
  organization_id,
  name,
  slug,
  description,
  default_price,
  is_active,
  sort_order
)
SELECT
  o.id,
  v.name,
  v.slug,
  v.description,
  v.default_price,
  true,
  v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    (
      'Extra Cleaning',
      'extra-cleaning',
      'Post-event extra cleaning fee. Staff enter the amount when charging.',
      0.00,
      100
    ),
    (
      'Damage Charge',
      'damage-charge',
      'Post-event damage charge. Staff enter the amount when charging.',
      0.00,
      110
    )
) AS v(name, slug, description, default_price, sort_order)
ON CONFLICT (organization_id, slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
