-- Mark an employee as Department Head (Director) for their assigned department.
-- Enables profile → department workspace access (same pattern as teacher program assignments).
-- Run after 185_program_enrollment_fa_awards.sql

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_department_head boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.staff.is_department_head IS
  'When true and department_id is set, this employee is Department Head (Director) for that department and may open the department workspace.';

CREATE INDEX IF NOT EXISTS staff_org_department_head_idx
  ON public.staff (organization_id, department_id)
  WHERE is_department_head = true AND department_id IS NOT NULL;
