-- Fix vendor application submitted_at to FIRST activity (earliest payment / event).
-- Does NOT require import_tag/notes (those may already be cleared).
-- Updates any vendor_hub application whose submitted_at is later than the
-- contact's earliest bazaar activity (or last_activity_at when that is earlier).
-- Safe to re-run.

WITH first_payment AS (
  SELECT
    contact_id,
    MIN(COALESCE(payment_date::timestamptz, created_at)) AS first_at
  FROM public.vendor_hub_payments
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
),
first_event AS (
  SELECT
    p.contact_id,
    MIN((e.event_date::text || 'T12:00:00.000Z')::timestamptz) AS first_at
  FROM public.vendor_hub_participant_status AS p
  INNER JOIN public.vendor_hub_events AS e ON e.id = p.vendor_hub_event_id
  WHERE p.contact_id IS NOT NULL
    AND e.event_date IS NOT NULL
  GROUP BY p.contact_id
),
first_assignment AS (
  SELECT
    ba.contact_id,
    MIN((e.event_date::text || 'T12:00:00.000Z')::timestamptz) AS first_at
  FROM public.vendor_hub_booth_assignments AS ba
  INNER JOIN public.vendor_hub_events AS e ON e.id = ba.event_id
  WHERE ba.contact_id IS NOT NULL
    AND e.event_date IS NOT NULL
  GROUP BY ba.contact_id
),
computed AS (
  SELECT
    a.id AS application_id,
    COALESCE(
      (
        SELECT MIN(v)
        FROM (
          VALUES
            (fp.first_at),
            (fe.first_at),
            (fa.first_at)
        ) AS dates(v)
        WHERE v IS NOT NULL
      ),
      -- Fallback when no payment/event rows: use last_activity only if older than submitted
      CASE
        WHEN c.last_activity_at IS NOT NULL
          AND (
            a.submitted_at IS NULL
            OR c.last_activity_at < a.submitted_at
          )
        THEN c.last_activity_at
        ELSE NULL
      END,
      c.created_at
    ) AS first_activity_at
  FROM public.applications AS a
  INNER JOIN public.contacts AS c ON c.id = a.contact_id
  LEFT JOIN first_payment AS fp ON fp.contact_id = c.id
  LEFT JOIN first_event AS fe ON fe.contact_id = c.id
  LEFT JOIN first_assignment AS fa ON fa.contact_id = c.id
  WHERE a.application_type = 'vendor'
    AND a.module_owner = 'vendor_hub'
)
UPDATE public.applications AS a
SET
  submitted_at = c.first_activity_at,
  reviewed_at = CASE
    WHEN a.reviewed_at IS NOT NULL
      AND a.submitted_at IS NOT NULL
      AND abs(extract(epoch FROM (a.reviewed_at - a.submitted_at))) < 2
    THEN NULL
    WHEN a.reviewed_by IS NULL
      AND (
        (a.form_data ? 'import_tag')
        OR coalesce(a.notes, '') ILIKE '%VENDOR_UPDATE_CSV%'
        OR coalesce(a.notes, '') ILIKE '%BAZAAR_VENDORS_CSV%'
        OR (
          a.reviewed_at IS NOT NULL
          AND a.submitted_at IS NOT NULL
          AND a.reviewed_at::date = a.submitted_at::date
        )
      )
    THEN NULL
    ELSE a.reviewed_at
  END,
  reviewed_by = CASE
    WHEN a.reviewed_by IS NULL THEN NULL
    ELSE a.reviewed_by
  END,
  updated_at = now()
FROM computed AS c
WHERE a.id = c.application_id
  AND c.first_activity_at IS NOT NULL
  AND (
    a.submitted_at IS NULL
    OR a.submitted_at::date IS DISTINCT FROM c.first_activity_at::date
    OR (a.form_data ? 'import_tag')
    OR coalesce(a.notes, '') ILIKE '%VENDOR_UPDATE_CSV%'
    OR coalesce(a.notes, '') ILIKE '%BAZAAR_VENDORS_CSV%'
  );

-- Clear import-marker internal notes
UPDATE public.applications
SET
  notes = NULL,
  updated_at = now()
WHERE application_type = 'vendor'
  AND module_owner = 'vendor_hub'
  AND (
    coalesce(notes, '') ILIKE '%VENDOR_UPDATE_CSV%'
    OR coalesce(notes, '') ILIKE '%BAZAAR_VENDORS_CSV%'
  );

-- Remove import_tag from form_data
UPDATE public.applications
SET
  form_data = form_data - 'import_tag',
  updated_at = now()
WHERE application_type = 'vendor'
  AND module_owner = 'vendor_hub'
  AND form_data ? 'import_tag';
