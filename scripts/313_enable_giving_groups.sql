-- Org switch for campaign groups on gift, pledge, and recurring forms.
-- Off by default. Campaign group records stay; the forms hide the field until an admin turns this on.
-- Run after 312_recurring_plan_goal_and_pledge.sql

ALTER TABLE public.donation_settings
  ADD COLUMN IF NOT EXISTS enable_giving_groups BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.donation_settings.enable_giving_groups IS
  'When true, staff can assign a campaign group on Receive Payment, pledges, and recurring plans. When false, those forms omit the field.';
