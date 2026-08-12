-- Department Terms and Conditions (rich text + PDF)
-- Run in Supabase SQL Editor after 203_department_flyer_url.sql.

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS terms_html TEXT,
  ADD COLUMN IF NOT EXISTS terms_pdf_url TEXT;

COMMENT ON COLUMN public.departments.terms_html IS
  'Rich-text HTML for department Terms and Conditions (sanitized on save).';

COMMENT ON COLUMN public.departments.terms_pdf_url IS
  'Public URL for the department Terms and Conditions PDF (program-flyers storage).';

NOTIFY pgrst, 'reload schema';
