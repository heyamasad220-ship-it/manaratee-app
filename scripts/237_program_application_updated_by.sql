-- =============================================================================
-- 237_program_application_updated_by.sql
-- Track who last updated a program application (for Applications list).
-- =============================================================================

ALTER TABLE public.program_applications
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.program_applications.updated_by_user_id IS
  'Staff/customer user who last saved or evaluated the application.';

-- Best-effort backfill from evaluate / create actors.
UPDATE public.program_applications
SET updated_by_user_id = COALESCE(evaluated_by_user_id, created_by_user_id)
WHERE updated_by_user_id IS NULL
  AND (evaluated_by_user_id IS NOT NULL OR created_by_user_id IS NOT NULL);
