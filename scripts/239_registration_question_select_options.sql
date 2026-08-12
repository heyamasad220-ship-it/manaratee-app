-- =============================================================================
-- 239_registration_question_select_options.sql
-- Add select (drop-down) question type + options JSON array.
-- Run after 201_program_offering_registration_questions.sql.
-- =============================================================================

ALTER TABLE public.program_offering_registration_questions
  DROP CONSTRAINT IF EXISTS program_offering_registration_questions_question_type_check;

ALTER TABLE public.program_offering_registration_questions
  ADD CONSTRAINT program_offering_registration_questions_question_type_check
  CHECK (question_type IN ('yes_no', 'text', 'textarea', 'select'));

ALTER TABLE public.program_offering_registration_questions
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.program_offering_registration_questions.options IS
  'Drop-down choices when question_type = select (JSON string array).';
