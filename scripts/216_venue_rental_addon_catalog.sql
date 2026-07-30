-- Venue rental add-on catalog defaults with prices.
-- Upserts the four standard extras; safe to re-run.
-- Run after 046_venue_rentals_workflow.sql.

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
    ('Table Covers', 'table-covers', 'Per table cover', 10.00, 10),
    ('Chair Covers', 'chair-covers', 'Per chair cover', 2.00, 20),
    ('Plate Chargers', 'plate-chargers', 'Per plate charger', 1.00, 30),
    ('Gift Table Setup', 'gift-table-setup', 'Gift table setup fee', 50.00, 40)
) AS v(name, slug, description, default_price, sort_order)
ON CONFLICT (organization_id, slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_price = EXCLUDED.default_price,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
