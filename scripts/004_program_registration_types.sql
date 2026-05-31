-- Allow full program and session registration independently or together
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.programs
ADD COLUMN IF NOT EXISTS full_program_registration_enabled BOOLEAN;

UPDATE public.programs
SET full_program_registration_enabled = NOT session_registration_enabled
WHERE full_program_registration_enabled IS NULL;

ALTER TABLE public.programs
ALTER COLUMN full_program_registration_enabled SET DEFAULT true;

ALTER TABLE public.programs
ALTER COLUMN full_program_registration_enabled SET NOT NULL;
