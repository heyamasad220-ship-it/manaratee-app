-- Store chairs-per-table on facility setup briefs (customer/staff rental requests).
-- Tables = ceil(expected_attendance / chairs_per_table). Safe to re-run.

ALTER TABLE public.operational_briefs
  ADD COLUMN IF NOT EXISTS chairs_per_table INTEGER
    CHECK (chairs_per_table IS NULL OR (chairs_per_table >= 1 AND chairs_per_table <= 100));

COMMENT ON COLUMN public.operational_briefs.chairs_per_table IS
  'Seats per banquet table entered on the rental/event request. Used with expected_attendance to derive table count for linens/setup.';

NOTIFY pgrst, 'reload schema';
