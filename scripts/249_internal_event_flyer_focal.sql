-- Flyer focal point for Community Calendar featured banner (object-position %).
ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS flyer_focal_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS flyer_focal_y numeric NOT NULL DEFAULT 50;

ALTER TABLE public.internal_events
  DROP CONSTRAINT IF EXISTS internal_events_flyer_focal_x_check;
ALTER TABLE public.internal_events
  ADD CONSTRAINT internal_events_flyer_focal_x_check
  CHECK (flyer_focal_x >= 0 AND flyer_focal_x <= 100);

ALTER TABLE public.internal_events
  DROP CONSTRAINT IF EXISTS internal_events_flyer_focal_y_check;
ALTER TABLE public.internal_events
  ADD CONSTRAINT internal_events_flyer_focal_y_check
  CHECK (flyer_focal_y >= 0 AND flyer_focal_y <= 100);

COMMENT ON COLUMN public.internal_events.flyer_focal_x IS
  'Horizontal object-position % (0–100) for Community Calendar flyer crop.';
COMMENT ON COLUMN public.internal_events.flyer_focal_y IS
  'Vertical object-position % (0–100) for Community Calendar flyer crop.';

NOTIFY pgrst, 'reload schema';
