-- Add group contact type for community collectives (halaqas, committees, pooled giving).
-- Run in Supabase SQL Editor before reclassify-mas-ledger-group-contacts.mjs --execute

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_contact_type_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IN ('individual', 'organization', 'group'));

COMMENT ON COLUMN public.contacts.contact_type IS
  'individual = person; organization = external entity (vendor, sponsor); group = internal collective (halaqa, committee) with optional primary_contact_name.';

-- Entity donor rows for groups (run after reclassifying contacts).
UPDATE public.donors d
SET donor_type = 'organization'
FROM public.contacts c
WHERE c.id = d.contact_id
  AND c.contact_type = 'group'
  AND d.donor_type <> 'organization';
