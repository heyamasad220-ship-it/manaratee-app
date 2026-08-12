-- Mark Vendor Network contacts inactive when Last Activity is older than 2 years.
-- Last Activity = COALESCE(last_activity_at, created_at). Safe to re-run.

UPDATE public.contacts c
SET status = 'inactive'
FROM public.contact_roles cr
WHERE cr.contact_id = c.id
  AND cr.organization_id = c.organization_id
  AND cr.role = 'vendor'
  AND COALESCE(c.status, 'active') <> 'inactive'
  AND COALESCE(c.last_activity_at, c.created_at) < (NOW() - INTERVAL '2 years');

UPDATE public.contacts c
SET status = 'active'
FROM public.contact_roles cr
WHERE cr.contact_id = c.id
  AND cr.organization_id = c.organization_id
  AND cr.role = 'vendor'
  AND COALESCE(c.status, 'active') <> 'active'
  AND COALESCE(c.last_activity_at, c.created_at) >= (NOW() - INTERVAL '2 years');
