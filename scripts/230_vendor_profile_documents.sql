-- Vendor profile documents + optional document kind on application_documents.
-- Run in Supabase SQL Editor after 229_vendor_hub_events_rls_perf.sql

ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS document_kind TEXT;

COMMENT ON COLUMN public.application_documents.document_kind IS
  'Staff-facing category for vendor/org docs (food_license, insurance_certificate, sales_tax_permit, other).';

CREATE INDEX IF NOT EXISTS application_documents_kind_idx
  ON public.application_documents (organization_id, document_kind);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-documents',
  'application-documents',
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

DROP POLICY IF EXISTS "Public read application documents" ON storage.objects;
CREATE POLICY "Public read application documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'application-documents');

DROP POLICY IF EXISTS "Org members upload application documents" ON storage.objects;
CREATE POLICY "Org members upload application documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application-documents'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Org members update application documents" ON storage.objects;
CREATE POLICY "Org members update application documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'application-documents'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Org members delete application documents" ON storage.objects;
CREATE POLICY "Org members delete application documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'application-documents'
    AND auth.role() = 'authenticated'
  );
