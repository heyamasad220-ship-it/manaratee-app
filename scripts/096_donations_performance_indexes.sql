-- Donations production performance indexes + dashboard summary RPCs.
-- Run after 095_donations_rls_hardening.sql

-- ---------------------------------------------------------------------------
-- payments (canonical ledger — highest query volume)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS payments_org_payment_date_idx
  ON public.payments (organization_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS payments_org_status_unlinked_idx
  ON public.payments (organization_id, status, payment_date DESC)
  WHERE pledge_id IS NULL;

CREATE INDEX IF NOT EXISTS payments_pledge_id_idx
  ON public.payments (pledge_id, payment_date DESC)
  WHERE pledge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_org_donor_date_idx
  ON public.payments (organization_id, donor_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS payments_org_campaign_idx
  ON public.payments (organization_id, campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_org_recurring_idx
  ON public.payments (organization_id, payment_date DESC)
  WHERE recurring_donation_plan_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- pledges
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS pledges_org_pledge_date_idx
  ON public.pledges (organization_id, pledge_date DESC);

CREATE INDEX IF NOT EXISTS pledges_org_donor_idx
  ON public.pledges (organization_id, donor_id);

CREATE INDEX IF NOT EXISTS pledges_org_campaign_idx
  ON public.pledges (organization_id, campaign_id)
  WHERE campaign_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- donors
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS donors_org_contact_unique_idx
  ON public.donors (organization_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS donors_org_full_name_idx
  ON public.donors (organization_id, full_name);

-- ---------------------------------------------------------------------------
-- donation_receipts + checkout sessions
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS donation_receipts_org_type_idx
  ON public.donation_receipts (organization_id, receipt_type);

CREATE INDEX IF NOT EXISTS donation_checkout_sessions_org_contact_idx
  ON public.donation_checkout_sessions (organization_id, contact_id, created_at DESC);
