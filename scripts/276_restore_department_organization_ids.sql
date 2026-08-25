-- Restore departments that were reassigned to the wrong tenant.
--
-- Cause: getDepartments() used to, when the selected org had zero departments,
-- update every RLS-visible department to that org. Users who belong to more
-- than one org (or who opened an empty demo org) could pull MAS Dallas
-- departments onto Horizon Community Foundation.
--
-- This infers the real organization from related programs, then staff.
-- Preview first, then run the UPDATE. Safe to re-run.

-- Preview mismatched departments
SELECT
  d.id,
  d.name AS department_name,
  d.organization_id AS current_organization_id,
  oc.name AS current_organization_name,
  inferred.organization_id AS inferred_organization_id,
  oi.name AS inferred_organization_name,
  inferred.source
FROM public.departments d
JOIN LATERAL (
  SELECT p.organization_id, 'programs'::text AS source
  FROM public.programs p
  WHERE p.department_id = d.id
  GROUP BY p.organization_id
  ORDER BY COUNT(*) DESC
  LIMIT 1
) inferred ON true
LEFT JOIN public.organizations oc ON oc.id = d.organization_id
LEFT JOIN public.organizations oi ON oi.id = inferred.organization_id
WHERE d.organization_id IS DISTINCT FROM inferred.organization_id

UNION ALL

SELECT
  d.id,
  d.name,
  d.organization_id,
  oc.name,
  inferred.organization_id,
  oi.name,
  inferred.source
FROM public.departments d
JOIN LATERAL (
  SELECT s.organization_id, 'staff'::text AS source
  FROM public.staff s
  WHERE s.department_id = d.id
  GROUP BY s.organization_id
  ORDER BY COUNT(*) DESC
  LIMIT 1
) inferred ON true
LEFT JOIN public.organizations oc ON oc.id = d.organization_id
LEFT JOIN public.organizations oi ON oi.id = inferred.organization_id
WHERE d.organization_id IS DISTINCT FROM inferred.organization_id
  AND NOT EXISTS (
    SELECT 1 FROM public.programs p WHERE p.department_id = d.id
  );

-- Restore from programs (authoritative)
UPDATE public.departments d
SET organization_id = inferred.organization_id
FROM (
  SELECT DISTINCT ON (p.department_id)
    p.department_id,
    p.organization_id
  FROM public.programs p
  WHERE p.department_id IS NOT NULL
  GROUP BY p.department_id, p.organization_id
  ORDER BY p.department_id, COUNT(*) DESC
) inferred
WHERE d.id = inferred.department_id
  AND d.organization_id IS DISTINCT FROM inferred.organization_id;

-- Restore remaining mismatches from staff
UPDATE public.departments d
SET organization_id = inferred.organization_id
FROM (
  SELECT DISTINCT ON (s.department_id)
    s.department_id,
    s.organization_id
  FROM public.staff s
  WHERE s.department_id IS NOT NULL
  GROUP BY s.department_id, s.organization_id
  ORDER BY s.department_id, COUNT(*) DESC
) inferred
WHERE d.id = inferred.department_id
  AND d.organization_id IS DISTINCT FROM inferred.organization_id;
