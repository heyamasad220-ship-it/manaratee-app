-- Bazaars live in Vendor Hub. The linked internal_events row is a date/place
-- hold for Facilities and Community Calendar — not an Event Management workspace.
-- Backward-compatible. Safe to re-run.
-- Run after scripts/300_event_management_source_of_truth.sql.

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS source_module TEXT NOT NULL DEFAULT 'event_management';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'internal_events_source_module_check'
      AND conrelid = 'public.internal_events'::regclass
  ) THEN
    ALTER TABLE public.internal_events
      ADD CONSTRAINT internal_events_source_module_check
      CHECK (source_module IN ('event_management', 'vendor_hub'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS internal_events_org_source_module_idx
  ON public.internal_events (organization_id, source_module);

-- Mark bazaar-owned holds. Do not convert ticketed, childcare, or campaign events
-- that a bazaar may have been linked to from the old Event Management picker.
UPDATE public.internal_events ie
SET source_module = 'vendor_hub'
FROM public.vendor_hub_events vhe
WHERE vhe.internal_event_id = ie.id
  AND ie.source_module IS DISTINCT FROM 'vendor_hub'
  AND COALESCE(ie.requires_ticketing, false) = false
  AND COALESCE(ie.requires_childcare, false) = false
  AND ie.campaign_id IS NULL;

UPDATE public.internal_events
SET
  requires_vendors = false,
  requires_childcare = false,
  requires_ticketing = false,
  workspace_features = COALESCE(workspace_features, '{}'::jsonb)
    || jsonb_build_object('vendors', true, 'youth', false)
WHERE source_module = 'vendor_hub';

COMMENT ON COLUMN public.internal_events.source_module IS
  'event_management = Event Management workspace. vendor_hub = bazaar date/place hold for Facilities and Community Calendar; hidden from Event Management lists.';

NOTIFY pgrst, 'reload schema';
