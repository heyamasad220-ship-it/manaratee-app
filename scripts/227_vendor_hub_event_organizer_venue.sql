-- Bazaar event organizer contact + facility space (replace mock dropdowns).
-- Email/phone stay on contacts; organizer_name is free-text committee/org label.

alter table public.vendor_hub_events
  add column if not exists organizer_contact_id uuid references public.contacts (id) on delete set null,
  add column if not exists organizer_name text,
  add column if not exists venue_id uuid references public.venues (id) on delete set null;

create index if not exists vendor_hub_events_organizer_contact_idx
  on public.vendor_hub_events (organizer_contact_id)
  where organizer_contact_id is not null;

create index if not exists vendor_hub_events_venue_idx
  on public.vendor_hub_events (venue_id)
  where venue_id is not null;
