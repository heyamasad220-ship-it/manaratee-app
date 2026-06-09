-- Rename HR module slug to workforce (display name: Workforce)
-- Run after 059_workforce_credentials.sql
-- Safe to re-run

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'modules'
  ) THEN
    UPDATE public.modules
    SET slug = 'workforce',
        name = 'Workforce',
        route = COALESCE(NULLIF(route, ''), '/workforce'),
        description = COALESCE(description, 'Employees, volunteers, and childcare providers')
    WHERE slug = 'hr';

    UPDATE public.modules
    SET name = 'Workforce',
        description = COALESCE(description, 'Employees, volunteers, and childcare providers')
    WHERE slug = 'workforce'
      AND name IN ('HR', 'People Management', 'Organization', 'Human Resources');
  END IF;
END $$;

-- application module_owner: hr -> workforce
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'application_type_definitions'
  ) THEN
    ALTER TABLE public.application_type_definitions
      DROP CONSTRAINT IF EXISTS application_type_definitions_module_owner_check;

    UPDATE public.application_type_definitions
    SET module_owner = 'workforce'
    WHERE module_owner = 'hr';

    ALTER TABLE public.application_type_definitions
      ADD CONSTRAINT application_type_definitions_module_owner_check
      CHECK (module_owner IN ('workforce', 'vendor_hub', 'programs'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'applications'
  ) THEN
    ALTER TABLE public.applications
      DROP CONSTRAINT IF EXISTS applications_module_owner_check;

    UPDATE public.applications
    SET module_owner = 'workforce'
    WHERE module_owner = 'hr';

    ALTER TABLE public.applications
      ADD CONSTRAINT applications_module_owner_check
      CHECK (module_owner IN ('workforce', 'vendor_hub', 'programs'));
  END IF;
END $$;
