-- Campaign goal phases + phase attribution on pledges/payments.
-- Backward-compatible: campaigns without phases keep working unchanged.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- campaigns.goal_breakdown_enabled
-- ---------------------------------------------------------------------------

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS goal_breakdown_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campaigns.goal_breakdown_enabled IS
  'When true, campaign uses optional phase goal breakdown (campaign_phases).';

-- ---------------------------------------------------------------------------
-- campaign_phases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal_amount numeric(14, 2),
  start_date date,
  deadline date,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_phases_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT campaign_phases_status_check CHECK (
    lower(status) IN ('active', 'completed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS campaign_phases_org_campaign_idx
  ON public.campaign_phases (organization_id, campaign_id, sort_order);

CREATE INDEX IF NOT EXISTS campaign_phases_campaign_id_idx
  ON public.campaign_phases (campaign_id);

COMMENT ON TABLE public.campaign_phases IS
  'Optional goal phases within a fundraising campaign (e.g. Pre-Event, Event Day).';

DROP TRIGGER IF EXISTS campaign_phases_updated_at ON public.campaign_phases;
CREATE TRIGGER campaign_phases_updated_at
  BEFORE UPDATE ON public.campaign_phases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.campaign_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaign phases" ON public.campaign_phases;
DROP POLICY IF EXISTS "Staff insert org campaign phases" ON public.campaign_phases;
DROP POLICY IF EXISTS "Staff update org campaign phases" ON public.campaign_phases;
DROP POLICY IF EXISTS "Staff delete org campaign phases" ON public.campaign_phases;

CREATE POLICY "Staff view org campaign phases"
  ON public.campaign_phases FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org campaign phases"
  ON public.campaign_phases FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaign phases"
  ON public.campaign_phases FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaign phases"
  ON public.campaign_phases FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- ---------------------------------------------------------------------------
-- Phase attribution on existing ledger (nullable; no double ledger)
-- ---------------------------------------------------------------------------

ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS campaign_phase_id uuid REFERENCES public.campaign_phases(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS campaign_phase_id uuid REFERENCES public.campaign_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pledges_campaign_phase_id_idx
  ON public.pledges (campaign_phase_id)
  WHERE campaign_phase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_campaign_phase_id_idx
  ON public.payments (campaign_phase_id)
  WHERE campaign_phase_id IS NOT NULL;

COMMENT ON COLUMN public.pledges.campaign_phase_id IS
  'Optional campaign phase for this pledge commitment.';

COMMENT ON COLUMN public.payments.campaign_phase_id IS
  'Optional campaign phase attribution for this payment.';

-- ---------------------------------------------------------------------------
-- Expose campaign_phase_id on pledge_status_view (recreate dependent views)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.donor_summary_view;
DROP VIEW IF EXISTS public.pledge_status_view;

CREATE VIEW public.pledge_status_view
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.organization_id,
  p.donor_id,
  d.full_name AS donor_name,
  p.campaign_id,
  c.name AS campaign_name,
  p.campaign_phase_id,
  p.amount_pledged,
  COALESCE(
    SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
    0::numeric
  ) AS amount_paid,
  CASE
    WHEN LOWER(COALESCE(p.status, '')) = 'cancelled' THEN 0::numeric
    ELSE GREATEST(
      p.amount_pledged - COALESCE(
        SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
        0::numeric
      ),
      0::numeric
    )
  END AS balance_remaining,
  p.pledge_date,
  p.pledge_type,
  p.frequency,
  p.installment_amount,
  p.total_payments,
  p.first_payment_date,
  p.next_payment_date,
  CASE
    WHEN LOWER(COALESCE(p.status, '')) = 'cancelled' THEN 'cancelled'::text
    WHEN COALESCE(
      SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
      0::numeric
    ) >= p.amount_pledged THEN 'fulfilled'::text
    WHEN COALESCE(
      SUM(public.payment_net_amount(pay.amount, pay.refunded_amount)),
      0::numeric
    ) > 0::numeric THEN 'partial'::text
    ELSE 'open'::text
  END AS calculated_status,
  p.status,
  p.notes,
  p.created_at
FROM public.pledges p
LEFT JOIN public.donors d ON d.id = p.donor_id
LEFT JOIN public.campaigns c ON c.id = p.campaign_id
LEFT JOIN public.payments pay
  ON pay.pledge_id = p.id
 AND LOWER(COALESCE(pay.status, '')) <> 'voided'
GROUP BY
  p.id,
  d.full_name,
  c.name,
  p.campaign_phase_id,
  p.installment_amount,
  p.total_payments,
  p.first_payment_date,
  p.next_payment_date;

CREATE VIEW public.donor_summary_view
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.organization_id,
  d.contact_id,
  d.donor_type,
  d.full_name,
  d.email,
  d.phone,
  d.status,
  d.created_at,
  COUNT(DISTINCT p.id) FILTER (
    WHERE public.payment_net_amount(p.amount, p.refunded_amount) > 0::numeric
  ) AS donation_count,
  COALESCE(
    SUM(public.payment_net_amount(p.amount, p.refunded_amount)),
    0::numeric
  ) AS total_donations,
  MAX(p.payment_date) FILTER (
    WHERE public.payment_net_amount(p.amount, p.refunded_amount) > 0::numeric
  ) AS last_donation_date,
  (
    EXISTS (
      SELECT 1
      FROM public.pledge_status_view psv
      WHERE psv.donor_id = d.id
        AND psv.balance_remaining > 0::numeric
    )
  ) AS has_open_pledge
FROM public.donors d
LEFT JOIN public.payments p
  ON p.donor_id = d.id
 AND LOWER(COALESCE(p.status, '')) <> 'voided'
GROUP BY d.id;

COMMENT ON VIEW public.pledge_status_view IS
  'Pledge balances from net non-voided payment amounts. Includes installment plan fields and campaign_phase_id. security_invoker.';

COMMENT ON VIEW public.donor_summary_view IS
  'Donor giving summary from non-voided payments. has_open_pledge=true only when pledge_status_view.balance_remaining > 0. security_invoker.';
