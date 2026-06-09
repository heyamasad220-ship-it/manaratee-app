-- Move Sign-Ups and Child Care back under People Management in the sidebar
-- Safe to re-run. Does not delete application, volunteer, or registration data.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    UPDATE public.modules
    SET is_active = false,
        default_enabled = false
    WHERE slug IN ('sign-ups', 'child-care');

    DELETE FROM public.organization_modules om
    USING public.modules m
    WHERE om.module_id = m.id
      AND m.slug IN ('sign-ups', 'child-care');
  END IF;
END $$;
