-- Allow closing time-limited funds (e.g. Zakat Al Fitr 2023) without deleting history.
ALTER TABLE public.donation_subcategories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.donation_subcategories.is_active IS
  'When false, fund is closed and hidden from new pledge/payment/donation pickers.';
