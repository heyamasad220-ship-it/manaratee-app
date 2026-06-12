-- Move Vendor Hub under Operations and retire the Services sidebar group
-- Run after 067_module_catalog_and_bundles.sql
-- Safe to re-run

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.modules
  SET
    group_name = 'Operations',
    sort_order = 43
  WHERE slug = 'vendor-hub';

  -- Legacy modules that still used the Services group (hidden from sidebar in app code)
  UPDATE public.modules
  SET group_name = 'Operations'
  WHERE slug IN ('bazaar', 'ticketing')
    AND group_name = 'Services';
END $$;
