-- Venue Rentals: customer policy documents + approval-after-agreement.
-- Extends venue_rental_settings (General) and venue_rentals agreement tracking.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Org settings: documents + approval mode
-- ---------------------------------------------------------------------------
ALTER TABLE public.venue_rental_settings
  ADD COLUMN IF NOT EXISTS policies_document_url TEXT,
  ADD COLUMN IF NOT EXISTS policies_document_name TEXT,
  ADD COLUMN IF NOT EXISTS pricing_guide_url TEXT,
  ADD COLUMN IF NOT EXISTS pricing_guide_name TEXT,
  ADD COLUMN IF NOT EXISTS approval_mode TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.venue_rental_settings
  DROP CONSTRAINT IF EXISTS venue_rental_settings_approval_mode_check;

ALTER TABLE public.venue_rental_settings
  ADD CONSTRAINT venue_rental_settings_approval_mode_check
  CHECK (approval_mode IN ('manual', 'auto_after_agreement'));

COMMENT ON COLUMN public.venue_rental_settings.policies_document_url IS
  'Public URL for Policies & procedures PDF sent on rental request submit.';
COMMENT ON COLUMN public.venue_rental_settings.pricing_guide_url IS
  'Public URL for Pricing guide PDF sent on rental request submit.';
COMMENT ON COLUMN public.venue_rental_settings.approval_mode IS
  'manual = staff approve after customer agrees; auto_after_agreement = approve when customer agrees.';

-- ---------------------------------------------------------------------------
-- Per-rental agreement tracking
-- ---------------------------------------------------------------------------
ALTER TABLE public.venue_rentals
  ADD COLUMN IF NOT EXISTS policies_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS policies_agreed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS policies_document_url_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS pricing_guide_url_snapshot TEXT;

COMMENT ON COLUMN public.venue_rentals.policies_sent_at IS
  'When policy/pricing documents were stamped for the customer on submit.';
COMMENT ON COLUMN public.venue_rentals.policies_agreed_at IS
  'When the customer agreed to the org policies/pricing documents.';
COMMENT ON COLUMN public.venue_rentals.policies_document_url_snapshot IS
  'Policies document URL at send time (version lock).';
COMMENT ON COLUMN public.venue_rentals.pricing_guide_url_snapshot IS
  'Pricing guide URL at send time (version lock).';

-- ---------------------------------------------------------------------------
-- Storage bucket for PDFs (service-role upload; public read)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'venue-rental-docs',
  'venue-rental-docs',
  true,
  15728640,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read venue rental docs" ON storage.objects;
CREATE POLICY "Public read venue rental docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'venue-rental-docs');

DROP POLICY IF EXISTS "Org members upload venue rental docs" ON storage.objects;
CREATE POLICY "Org members upload venue rental docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'venue-rental-docs'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Org members update venue rental docs" ON storage.objects;
CREATE POLICY "Org members update venue rental docs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'venue-rental-docs'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Org members delete venue rental docs" ON storage.objects;
CREATE POLICY "Org members delete venue rental docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'venue-rental-docs'
    AND auth.role() = 'authenticated'
  );
