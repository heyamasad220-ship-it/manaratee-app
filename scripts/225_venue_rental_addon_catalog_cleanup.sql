-- Cleanup Fee belongs in post-event staff flow, not customer book-a-space add-ons.
-- Duplicate Chair Covers / Gift Table rows came from overlapping seed catalogs (046 + 216).
-- Keeps: chair-covers, gift-table-setup. Deactivates: cleanup-fee, gift-table, extra chair-cover rows.

update public.rental_addons
set is_active = false,
    updated_at = now()
where slug in ('cleanup-fee', 'gift-table')
  and is_active = true;

-- Extra chair-cover catalog rows (keep the standard slug from script 216).
update public.rental_addons
set is_active = false,
    updated_at = now()
where is_active = true
  and lower(trim(name)) = 'chair covers'
  and slug is distinct from 'chair-covers';

-- Safety: any remaining active Cleanup Fee by name.
update public.rental_addons
set is_active = false,
    updated_at = now()
where is_active = true
  and lower(trim(name)) in ('cleanup fee', 'cleanup');
