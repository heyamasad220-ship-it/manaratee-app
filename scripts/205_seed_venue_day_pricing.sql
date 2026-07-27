-- Seed per-day venue pricing from legacy peak/non-peak columns when empty.
-- Requires rental_space_pricing from scripts/046_venue_rentals_workflow.sql.
-- Day of week: 0=Sunday … 6=Saturday.

INSERT INTO public.rental_space_pricing (
  organization_id,
  venue_id,
  day_of_week,
  start_time,
  end_time,
  flat_price,
  hourly_price,
  is_active
)
SELECT
  v.organization_id,
  v.id,
  d.day_of_week,
  COALESCE(v.availability_start, TIME '08:00'),
  COALESCE(v.availability_end, TIME '22:00'),
  CASE
    WHEN d.day_of_week IN (0, 5, 6) THEN COALESCE(v.peak_flat_price, v.base_price, 0)
    ELSE COALESCE(v.base_price, 0)
  END,
  CASE
    WHEN d.day_of_week IN (0, 5, 6) THEN COALESCE(v.peak_hourly_rate, v.hourly_rate, 0)
    ELSE COALESCE(v.hourly_rate, 0)
  END,
  true
FROM public.venues v
CROSS JOIN (
  VALUES (0), (1), (2), (3), (4), (5), (6)
) AS d(day_of_week)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.rental_space_pricing p
  WHERE p.venue_id = v.id
)
AND COALESCE(v.availability_end, TIME '22:00') > COALESCE(v.availability_start, TIME '08:00');
