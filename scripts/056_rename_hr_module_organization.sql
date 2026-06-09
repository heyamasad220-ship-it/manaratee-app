-- Rename HR module display name to Organization
-- Run after 055_organization_affiliations.sql
-- Safe to re-run

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'modules') THEN
    UPDATE public.modules
    SET name = 'Organization'
    WHERE slug = 'hr'
      AND name IN ('HR', 'People Management', 'Human Resources');
  END IF;
END $$;
