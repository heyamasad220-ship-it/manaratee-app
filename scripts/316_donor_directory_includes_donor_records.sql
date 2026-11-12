-- Directory → Donors uses search_donor_giving_contact_ids.
-- Include a linked donor record (pledge or gift), not only contacts who already paid.
-- Run after 315_donor_role_from_donor_record.sql. Safe to re-run.

CREATE OR REPLACE FUNCTION public.search_donor_giving_contact_ids(
  p_org_id uuid,
  p_search text DEFAULT NULL,
  p_contact_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  contact_id uuid,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(btrim(p_search), '');
BEGIN
  RETURN QUERY
  WITH donor_contacts AS (
    SELECT DISTINCT c.id AS contact_id
    FROM public.contacts c
    WHERE c.organization_id = p_org_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.donors d
          WHERE d.organization_id = p_org_id
            AND d.contact_id = c.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.payments p
          WHERE p.organization_id = p_org_id
            AND p.contact_id = c.id
            AND LOWER(COALESCE(p.status, '')) <> 'voided'
        )
      )
  ),
  filtered AS (
    SELECT c.id AS contact_id, c.created_at
    FROM public.contacts c
    INNER JOIN donor_contacts dc ON dc.contact_id = c.id
    WHERE c.organization_id = p_org_id
      AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
      AND (p_status IS NULL OR LOWER(COALESCE(c.status, '')) = LOWER(p_status))
      AND (
        v_search IS NULL
        OR c.full_name ILIKE '%' || v_search || '%'
        OR c.email ILIKE '%' || v_search || '%'
        OR c.phone ILIKE '%' || v_search || '%'
        OR COALESCE(c.primary_contact_name, '') ILIKE '%' || v_search || '%'
      )
  ),
  counted AS (
    SELECT f.contact_id, f.created_at, COUNT(*) OVER () AS total_count
    FROM filtered f
  )
  SELECT counted.contact_id, counted.total_count
  FROM counted
  ORDER BY counted.created_at DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

COMMENT ON FUNCTION public.search_donor_giving_contact_ids IS
  'Paginated contact IDs with a linked donor record or a non-voided payment. Used by Directory Donors.';
