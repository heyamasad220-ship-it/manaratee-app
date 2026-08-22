-- Campaign wishlist items: campaign-specific funding priorities (not a second ledger).
-- Nullable wishlist_item_id on pledges, payments, recurring plans, and checkout sessions.
-- Backward-compatible. Safe to re-run.
-- Run after scripts/266_group_recurring_and_fd_emails.sql.

CREATE TABLE IF NOT EXISTS public.campaign_wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  item_type text NOT NULL DEFAULT 'other',
  description text,
  target_amount numeric(14, 2) NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'medium',
  project_status text NOT NULL DEFAULT 'planned',
  target_completion_date date,
  actual_completion_date date,
  completion_notes text,
  fund_id uuid REFERENCES public.donation_subcategories(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  campaign_phase_id uuid REFERENCES public.campaign_phases(id) ON DELETE SET NULL,
  public_visible boolean NOT NULL DEFAULT false,
  public_token text NOT NULL,
  link_active boolean NOT NULL DEFAULT true,
  carry_forward_enabled boolean NOT NULL DEFAULT false,
  carried_from_item_id uuid REFERENCES public.campaign_wishlist_items(id) ON DELETE SET NULL,
  carried_to_item_id uuid REFERENCES public.campaign_wishlist_items(id) ON DELETE SET NULL,
  previous_funding_amount numeric(14, 2) NOT NULL DEFAULT 0,
  remaining_need_at_carry_forward numeric(14, 2),
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  image_url text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT campaign_wishlist_items_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT campaign_wishlist_items_target_non_negative CHECK (target_amount >= 0),
  CONSTRAINT campaign_wishlist_items_previous_funding_non_negative CHECK (previous_funding_amount >= 0),
  CONSTRAINT campaign_wishlist_items_priority_check CHECK (
    lower(priority) IN ('high', 'medium', 'low')
  ),
  CONSTRAINT campaign_wishlist_items_project_status_check CHECK (
    lower(project_status) IN ('planned', 'approved', 'in_progress', 'completed', 'on_hold', 'cancelled')
  ),
  CONSTRAINT campaign_wishlist_items_type_check CHECK (
    lower(item_type) IN (
      'facility',
      'renovation',
      'equipment',
      'technology',
      'education',
      'youth',
      'programming',
      'staffing',
      'community_services',
      'other'
    )
  ),
  CONSTRAINT campaign_wishlist_items_public_token_unique UNIQUE (public_token)
);

CREATE INDEX IF NOT EXISTS campaign_wishlist_items_org_campaign_idx
  ON public.campaign_wishlist_items (organization_id, campaign_id, sort_order);

CREATE INDEX IF NOT EXISTS campaign_wishlist_items_campaign_status_idx
  ON public.campaign_wishlist_items (campaign_id, project_status)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS campaign_wishlist_items_public_idx
  ON public.campaign_wishlist_items (organization_id, public_visible, link_active)
  WHERE public_visible = true AND archived_at IS NULL;

COMMENT ON TABLE public.campaign_wishlist_items IS
  'Campaign-specific funding priorities/projects. Sub-goals only — do not add to campaign.goal_amount. Totals come from pledges/payments.wishlist_item_id.';

DROP TRIGGER IF EXISTS campaign_wishlist_items_updated_at ON public.campaign_wishlist_items;
CREATE TRIGGER campaign_wishlist_items_updated_at
  BEFORE UPDATE ON public.campaign_wishlist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.campaign_wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view org campaign wishlist items" ON public.campaign_wishlist_items;
DROP POLICY IF EXISTS "Staff insert org campaign wishlist items" ON public.campaign_wishlist_items;
DROP POLICY IF EXISTS "Staff update org campaign wishlist items" ON public.campaign_wishlist_items;
DROP POLICY IF EXISTS "Staff delete org campaign wishlist items" ON public.campaign_wishlist_items;

CREATE POLICY "Staff view org campaign wishlist items"
  ON public.campaign_wishlist_items FOR SELECT
  USING (public.auth_user_can_view_donations(organization_id));

CREATE POLICY "Staff insert org campaign wishlist items"
  ON public.campaign_wishlist_items FOR INSERT
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff update org campaign wishlist items"
  ON public.campaign_wishlist_items FOR UPDATE
  USING (public.auth_user_can_manage_donations(organization_id))
  WITH CHECK (public.auth_user_can_manage_donations(organization_id));

CREATE POLICY "Staff delete org campaign wishlist items"
  ON public.campaign_wishlist_items FOR DELETE
  USING (public.auth_user_can_manage_donations(organization_id));

-- Public donate pages resolve by token via service role (no anon SELECT).

ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS wishlist_item_id uuid
    REFERENCES public.campaign_wishlist_items(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS wishlist_item_id uuid
    REFERENCES public.campaign_wishlist_items(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_donation_plans
  ADD COLUMN IF NOT EXISTS wishlist_item_id uuid
    REFERENCES public.campaign_wishlist_items(id) ON DELETE SET NULL;

ALTER TABLE public.donation_checkout_sessions
  ADD COLUMN IF NOT EXISTS wishlist_item_id uuid
    REFERENCES public.campaign_wishlist_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pledges_wishlist_item_id_idx
  ON public.pledges (wishlist_item_id)
  WHERE wishlist_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_wishlist_item_id_idx
  ON public.payments (wishlist_item_id)
  WHERE wishlist_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS recurring_donation_plans_wishlist_item_id_idx
  ON public.recurring_donation_plans (wishlist_item_id)
  WHERE wishlist_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS donation_checkout_sessions_wishlist_item_idx
  ON public.donation_checkout_sessions (wishlist_item_id)
  WHERE wishlist_item_id IS NOT NULL;

COMMENT ON COLUMN public.pledges.wishlist_item_id IS
  'Optional campaign wishlist item this pledge is committed toward. Does not create a second transaction.';

COMMENT ON COLUMN public.payments.wishlist_item_id IS
  'Optional campaign wishlist item this payment is attributed to. Same payment still counts once for campaign/org/donor totals.';

COMMENT ON COLUMN public.recurring_donation_plans.wishlist_item_id IS
  'Optional campaign wishlist item for recurring plan payments.';

COMMENT ON COLUMN public.donation_checkout_sessions.wishlist_item_id IS
  'Wishlist item for public wishlist donation links.';
