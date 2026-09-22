-- Event Management as the single event identity.
-- 1) Real campaign_id on internal_events (replaces JSON-only linkedCampaignId).
-- 2) Every vendor_hub_events row must point at an internal_events row.
-- 3) childcare_events is a signup sheet, not a second event list (requires source).
-- Backward-compatible. Safe to re-run.
-- Run after scripts/292_campaign_same_organization_fks.sql and 075_vendor_hub_events_internal_link.sql.

-- ---------------------------------------------------------------------------
-- Campaign FK on Event Management
-- ---------------------------------------------------------------------------
ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS campaign_id UUID;

UPDATE public.internal_events ie
SET campaign_id = camp.id
FROM public.campaigns camp
WHERE ie.campaign_id IS NULL
  AND ie.organization_id = camp.organization_id
  AND camp.id::text = NULLIF(btrim(ie.ticketing_config->>'linkedCampaignId'), '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'internal_events_campaign_org_fkey'
      AND conrelid = 'public.internal_events'::regclass
  ) THEN
    ALTER TABLE public.internal_events
      ADD CONSTRAINT internal_events_campaign_org_fkey
      FOREIGN KEY (campaign_id, organization_id)
      REFERENCES public.campaigns (id, organization_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS internal_events_campaign_idx
  ON public.internal_events (organization_id, campaign_id)
  WHERE campaign_id IS NOT NULL;

COMMENT ON COLUMN public.internal_events.campaign_id IS
  'Fund Development campaign this event belongs to. Source of truth for the campaign Event tab.';

-- Keep JSON in sync for older app builds.
UPDATE public.internal_events
SET ticketing_config = jsonb_set(
  COALESCE(ticketing_config, '{}'::jsonb),
  '{linkedCampaignId}',
  to_jsonb(campaign_id::text),
  true
)
WHERE campaign_id IS NOT NULL
  AND COALESCE(ticketing_config->>'linkedCampaignId', '') IS DISTINCT FROM campaign_id::text;

-- ---------------------------------------------------------------------------
-- Childcare signup sheet must belong to an Event Management event or a program
-- ---------------------------------------------------------------------------
DELETE FROM public.childcare_events
WHERE source_id IS NULL OR source_type IS NULL;

ALTER TABLE public.childcare_events
  ALTER COLUMN source_type SET NOT NULL,
  ALTER COLUMN source_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS childcare_events_source_unique_idx
  ON public.childcare_events (organization_id, source_type, source_id);

COMMENT ON COLUMN public.childcare_events.source_id IS
  'Owning Event Management event or program. Childcare is not its own event list.';

-- ---------------------------------------------------------------------------
-- Ensure Community Event type exists for orgs that have bazaars
-- ---------------------------------------------------------------------------
INSERT INTO public.event_types (organization_id, name, slug, sort_order)
SELECT DISTINCT vhe.organization_id, 'Community Event', 'community', 30
FROM public.vendor_hub_events vhe
WHERE vhe.organization_id IS NOT NULL
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Link bazaars that already match an Event Management row (same org, name, date)
-- ---------------------------------------------------------------------------
UPDATE public.vendor_hub_events vhe
SET internal_event_id = ie.id
FROM public.internal_events ie
WHERE vhe.internal_event_id IS NULL
  AND vhe.organization_id IS NOT NULL
  AND ie.organization_id = vhe.organization_id
  AND lower(btrim(ie.name)) = lower(btrim(vhe.name))
  AND vhe.event_date IS NOT NULL
  AND (ie.start_at AT TIME ZONE 'America/Chicago')::date = vhe.event_date
  AND NOT EXISTS (
    SELECT 1
    FROM public.vendor_hub_events other
    WHERE other.internal_event_id = ie.id
      AND other.id <> vhe.id
  );

-- ---------------------------------------------------------------------------
-- Create Event Management rows for remaining bazaars (one row per bazaar)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  new_event_id uuid;
  start_at timestamptz;
  end_at timestamptz;
  event_status text;
BEGIN
  FOR r IN
    SELECT
      vhe.id AS bazaar_id,
      vhe.organization_id,
      vhe.name,
      vhe.description,
      vhe.location,
      vhe.flyer_url,
      vhe.calendar_status,
      vhe.venue_id,
      vhe.event_date,
      vhe.start_time,
      vhe.end_time,
      (
        SELECT d.id
        FROM public.departments d
        WHERE d.organization_id = vhe.organization_id
        ORDER BY
          CASE
            WHEN lower(d.name) IN ('center', 'administration', 'admin') THEN 0
            ELSE 1
          END,
          d.name
        LIMIT 1
      ) AS department_id,
      (
        SELECT et.id
        FROM public.event_types et
        WHERE et.organization_id = vhe.organization_id
        ORDER BY
          CASE WHEN et.slug = 'community' THEN 0 ELSE 1 END,
          et.sort_order,
          et.name
        LIMIT 1
      ) AS event_type_id
    FROM public.vendor_hub_events vhe
    WHERE vhe.internal_event_id IS NULL
      AND vhe.organization_id IS NOT NULL
  LOOP
    IF r.department_id IS NULL OR r.event_type_id IS NULL THEN
      RAISE EXCEPTION
        'Cannot backfill bazaar %: organization % needs a department and event type',
        r.bazaar_id, r.organization_id;
    END IF;

    IF r.event_date IS NULL THEN
      start_at := NULL;
      end_at := NULL;
    ELSE
      start_at := timezone(
        'America/Chicago',
        (r.event_date::text || ' ' || COALESCE(substring(r.start_time::text from 1 for 8), '12:00:00'))::timestamp
      );
      end_at := timezone(
        'America/Chicago',
        (r.event_date::text || ' ' || COALESCE(substring(r.end_time::text from 1 for 8), '13:00:00'))::timestamp
      );
    END IF;

    IF end_at IS NOT NULL AND end_at < NOW() THEN
      event_status := 'completed';
    ELSIF start_at IS NOT NULL AND start_at < NOW() THEN
      event_status := 'completed';
    ELSE
      event_status := 'confirmed';
    END IF;

    INSERT INTO public.internal_events (
      organization_id,
      department_id,
      event_type_id,
      name,
      description,
      status,
      start_at,
      end_at,
      location_type,
      location_label,
      venue_id,
      flyer_url,
      community_calendar_status,
      requires_vendors,
      workspace_features,
      timezone
    )
    VALUES (
      r.organization_id,
      r.department_id,
      r.event_type_id,
      r.name,
      r.description,
      event_status,
      start_at,
      end_at,
      CASE WHEN r.venue_id IS NOT NULL THEN 'facility' ELSE 'external' END,
      r.location,
      r.venue_id,
      r.flyer_url,
      CASE
        WHEN r.calendar_status IN ('published', 'community_visible') THEN r.calendar_status
        ELSE 'not_published'
      END,
      true,
      jsonb_build_object('vendors', true),
      'America/Chicago'
    )
    RETURNING id INTO new_event_id;

    UPDATE public.vendor_hub_events
    SET internal_event_id = new_event_id
    WHERE id = r.bazaar_id;
  END LOOP;
END $$;

-- Mark linked Event Management rows as vendor events
UPDATE public.internal_events ie
SET
  requires_vendors = true,
  workspace_features = COALESCE(ie.workspace_features, '{}'::jsonb) || jsonb_build_object('vendors', true)
FROM public.vendor_hub_events vhe
WHERE vhe.internal_event_id = ie.id
  AND (
    ie.requires_vendors IS DISTINCT FROM true
    OR COALESCE(ie.workspace_features->>'vendors', '') IS DISTINCT FROM 'true'
  );

-- Require the link going forward
ALTER TABLE public.vendor_hub_events
  ALTER COLUMN internal_event_id SET NOT NULL;

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY (con.conkey)
  WHERE con.conrelid = 'public.vendor_hub_events'::regclass
    AND con.contype = 'f'
    AND att.attname = 'internal_event_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.vendor_hub_events DROP CONSTRAINT %I',
      fk_name
    );
  END IF;

  ALTER TABLE public.vendor_hub_events
    ADD CONSTRAINT vendor_hub_events_internal_event_id_fkey
    FOREIGN KEY (internal_event_id)
    REFERENCES public.internal_events(id)
    ON DELETE RESTRICT;
END $$;

COMMENT ON COLUMN public.vendor_hub_events.internal_event_id IS
  'Required Event Management event. Vendor Hub stores booths/vendors/payments only.';

NOTIFY pgrst, 'reload schema';
