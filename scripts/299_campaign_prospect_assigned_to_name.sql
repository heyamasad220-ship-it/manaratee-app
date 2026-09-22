-- Assigned to on campaign prospects is an employee name, not a Directory
-- person/organization. Until Administration is on for Fund Development,
-- staff type a name and save it. assigned_to_contact_id stays for a later
-- employee lookup. Safe to re-run.

ALTER TABLE public.campaign_prospects
  ADD COLUMN IF NOT EXISTS assigned_to_name text;

UPDATE public.campaign_prospects p
SET assigned_to_name = NULLIF(BTRIM(c.full_name), '')
FROM public.contacts c
WHERE p.assigned_to_contact_id = c.id
  AND (p.assigned_to_name IS NULL OR BTRIM(p.assigned_to_name) = '');
