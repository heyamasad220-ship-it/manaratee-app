-- Recurring plans: campaign group attribution + email template expansions.
-- Backward-compatible. Safe to re-run.
-- Run after scripts/265_donations_granular_permissions.sql.

ALTER TABLE public.recurring_donation_plans
  ADD COLUMN IF NOT EXISTS campaign_group_id uuid
    REFERENCES public.campaign_groups(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_donation_plans
  ADD COLUMN IF NOT EXISTS attributed_group_contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recurring_donation_plans_campaign_group_idx
  ON public.recurring_donation_plans (campaign_group_id)
  WHERE campaign_group_id IS NOT NULL;

COMMENT ON COLUMN public.recurring_donation_plans.campaign_group_id IS
  'Campaign fundraising group for public/group recurring donation links.';

-- Expand transactional email templates for FD reminders.
ALTER TABLE public.transactional_email_log
  DROP CONSTRAINT IF EXISTS transactional_email_log_template_check;

ALTER TABLE public.transactional_email_log
  ADD CONSTRAINT transactional_email_log_template_check
  CHECK (
    template IN (
      'receipt',
      'year_end_statement',
      'pledge_reminder',
      'group_pledge_confirmation',
      'prospect_follow_up_reminder'
    )
  );

ALTER TABLE public.transactional_email_log
  DROP CONSTRAINT IF EXISTS transactional_email_log_related_entity_type_check;

ALTER TABLE public.transactional_email_log
  ADD CONSTRAINT transactional_email_log_related_entity_type_check
  CHECK (
    related_entity_type IS NULL
    OR related_entity_type IN (
      'donation_receipt',
      'pledge_reminder',
      'pledge',
      'campaign_prospect'
    )
  );

-- Dedup log for daily prospect follow-up digests (one email per assignee per day).
CREATE TABLE IF NOT EXISTS public.prospect_follow_up_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assignee_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  reminder_date date NOT NULL DEFAULT (CURRENT_DATE),
  overdue_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_follow_up_reminder_log_unique
    UNIQUE (organization_id, recipient_email, reminder_date)
);

CREATE INDEX IF NOT EXISTS prospect_follow_up_reminder_log_org_date_idx
  ON public.prospect_follow_up_reminder_log (organization_id, reminder_date DESC);

ALTER TABLE public.prospect_follow_up_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view prospect follow-up reminder log"
  ON public.prospect_follow_up_reminder_log;
CREATE POLICY "Staff view prospect follow-up reminder log"
  ON public.prospect_follow_up_reminder_log FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));
