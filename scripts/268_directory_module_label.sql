-- User-facing Contacts module label → Directory.
-- Canonical table remains public.contacts. No schema rename.

UPDATE public.modules
SET
  name = 'Directory',
  route = '/directory',
  description = COALESCE(description, 'People, families, organizations, groups, and roles')
WHERE slug = 'contacts';
