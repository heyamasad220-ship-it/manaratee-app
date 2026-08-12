-- Org-level default booth types: allow event_id NULL + organization_id.
-- Defaults live in Vendor Hub Settings → Booths; events copy them into event-scoped rows.
-- Safe to re-run.

ALTER TABLE public.vendor_hub_booth_types
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill organization_id from the parent event when missing.
UPDATE public.vendor_hub_booth_types bt
SET organization_id = e.organization_id
FROM public.vendor_hub_events e
WHERE bt.event_id = e.id
  AND bt.organization_id IS NULL
  AND e.organization_id IS NOT NULL;

-- Allow org defaults (no event).
ALTER TABLE public.vendor_hub_booth_types
  ALTER COLUMN event_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS vendor_hub_booth_types_org_defaults_idx
  ON public.vendor_hub_booth_types (organization_id, sort_order)
  WHERE event_id IS NULL;

CREATE INDEX IF NOT EXISTS vendor_hub_booth_types_event_idx
  ON public.vendor_hub_booth_types (event_id, sort_order)
  WHERE event_id IS NOT NULL;
