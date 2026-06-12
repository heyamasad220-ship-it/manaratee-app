-- Bazaar event flyer storage + public share links
-- Run in Supabase SQL Editor after 084_vendor_hub_reminder_log.sql

ALTER TABLE public.vendor_hub_events
  ADD COLUMN IF NOT EXISTS flyer_url TEXT,
  ADD COLUMN IF NOT EXISTS public_share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_hub_events_public_share_token_idx
  ON public.vendor_hub_events(public_share_token)
  WHERE public_share_token IS NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('bazaar-flyers', 'bazaar-flyers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Organization members can upload bazaar flyers" ON storage.objects;
CREATE POLICY "Organization members can upload bazaar flyers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bazaar-flyers'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organization members can update bazaar flyers" ON storage.objects;
CREATE POLICY "Organization members can update bazaar flyers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bazaar-flyers'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organization members can delete bazaar flyers" ON storage.objects;
CREATE POLICY "Organization members can delete bazaar flyers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bazaar-flyers'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public read access for bazaar flyers" ON storage.objects;
CREATE POLICY "Public read access for bazaar flyers"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'bazaar-flyers');

COMMENT ON COLUMN public.vendor_hub_events.public_share_token IS
  'Opaque token for the public bazaar landing page (/bazaar/{token}).';
