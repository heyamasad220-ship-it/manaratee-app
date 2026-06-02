-- Rename HR module display name to People Management
-- Safe to re-run

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    UPDATE public.modules
    SET name = 'People Management'
    WHERE slug = 'hr'
       OR name IN ('HR', 'Human Resources', 'hr');
  ELSE
    UPDATE public.modules
    SET name = 'People Management'
    WHERE name IN ('HR', 'Human Resources', 'hr');
  END IF;
END $$;
