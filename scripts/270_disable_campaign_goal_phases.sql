-- Disable campaign goal phases: each campaign has a single goal.
-- Does not drop campaign_phases or campaign_phase_id columns (FKs remain, unused).
-- Run in Supabase SQL editor after deploying the app change.

UPDATE public.pledges
SET campaign_phase_id = NULL
WHERE campaign_phase_id IS NOT NULL;

UPDATE public.payments
SET campaign_phase_id = NULL
WHERE campaign_phase_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_ask_levels'
      AND column_name = 'campaign_phase_id'
  ) THEN
    UPDATE public.campaign_ask_levels
    SET campaign_phase_id = NULL
    WHERE campaign_phase_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_wishlist_items'
      AND column_name = 'campaign_phase_id'
  ) THEN
    UPDATE public.campaign_wishlist_items
    SET campaign_phase_id = NULL
    WHERE campaign_phase_id IS NOT NULL;
  END IF;
END $$;

DELETE FROM public.campaign_phases;

UPDATE public.campaigns
SET goal_breakdown_enabled = FALSE
WHERE goal_breakdown_enabled IS DISTINCT FROM FALSE;
