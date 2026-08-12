-- Backfill sticky vendor roles for contacts with an approved org vendor application.
-- Fixes Vendor Network under-count vs approved application count after imports/merges.
-- Safe to re-run.

INSERT INTO public.contact_roles (organization_id, contact_id, role)
SELECT DISTINCT
  a.organization_id,
  a.contact_id,
  'vendor'
FROM public.applications a
WHERE a.application_type = 'vendor'
  AND a.module_owner = 'vendor_hub'
  AND a.status = 'approved'
  AND a.contact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.contact_roles cr
    WHERE cr.organization_id = a.organization_id
      AND cr.contact_id = a.contact_id
      AND cr.role = 'vendor'
  );

-- If is_manual exists, leave new rows as automatic (default false / null).
