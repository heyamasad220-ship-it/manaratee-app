-- Prevent campaign child rows (and ledger campaign/wishlist links) from pointing at another tenant.
-- Service-role writes bypass RLS, so a campaign_id FK on id alone was not enough.
-- Composite FKs are used where ON DELETE CASCADE is safe.
-- Ledger tables keep SET NULL on campaign_id / wishlist_item_id; a trigger enforces the same org
-- because composite FK ON DELETE SET NULL would also try to null organization_id.
-- Backward-compatible. Safe to re-run.
-- Run after scripts/267_campaign_wishlist.sql and 285_campaign_sponsorship_packages.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_id_organization_id_key'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_id_organization_id_key UNIQUE (id, organization_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._add_campaign_org_fkey(
  p_table regclass,
  p_old_con text,
  p_new_con text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = p_new_con AND conrelid = p_table
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = p_old_con AND conrelid = p_table
  ) THEN
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', p_table, p_old_con);
  END IF;

  EXECUTE format(
    'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (campaign_id, organization_id) REFERENCES public.campaigns (id, organization_id) ON DELETE CASCADE',
    p_table,
    p_new_con
  );
END;
$$;

SELECT public._add_campaign_org_fkey('public.campaign_wishlist_items'::regclass, 'campaign_wishlist_items_campaign_id_fkey', 'campaign_wishlist_items_campaign_org_fkey');
SELECT public._add_campaign_org_fkey('public.campaign_groups'::regclass, 'campaign_groups_campaign_id_fkey', 'campaign_groups_campaign_org_fkey');
SELECT public._add_campaign_org_fkey('public.campaign_phases'::regclass, 'campaign_phases_campaign_id_fkey', 'campaign_phases_campaign_org_fkey');
SELECT public._add_campaign_org_fkey('public.campaign_ask_levels'::regclass, 'campaign_ask_levels_campaign_id_fkey', 'campaign_ask_levels_campaign_org_fkey');
SELECT public._add_campaign_org_fkey('public.campaign_prospects'::regclass, 'campaign_prospects_campaign_id_fkey', 'campaign_prospects_campaign_org_fkey');
SELECT public._add_campaign_org_fkey('public.campaign_prospect_activities'::regclass, 'campaign_prospect_activities_campaign_id_fkey', 'campaign_prospect_activities_campaign_org_fkey');
SELECT public._add_campaign_org_fkey('public.campaign_sponsorships'::regclass, 'campaign_sponsorships_campaign_id_fkey', 'campaign_sponsorships_campaign_org_fkey');
SELECT public._add_campaign_org_fkey('public.sponsorship_packages'::regclass, 'sponsorship_packages_campaign_id_fkey', 'sponsorship_packages_campaign_org_fkey');

DROP FUNCTION public._add_campaign_org_fkey(regclass, text, text);

CREATE OR REPLACE FUNCTION public.campaign_belongs_to_org(p_campaign_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = p_campaign_id
      AND c.organization_id = p_org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_campaign_same_organization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.campaign_id IS NOT DISTINCT FROM OLD.campaign_id
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.campaign_belongs_to_org(NEW.campaign_id, NEW.organization_id) THEN
    RAISE EXCEPTION 'campaign_id must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_wishlist_item_same_organization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.wishlist_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.wishlist_item_id IS NOT DISTINCT FROM OLD.wishlist_item_id
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.campaign_wishlist_items w
    WHERE w.id = NEW.wishlist_item_id
      AND w.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'wishlist_item_id must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_wishlist_carry_same_organization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.carried_from_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.campaign_wishlist_items w
       WHERE w.id = NEW.carried_from_item_id
         AND w.organization_id = NEW.organization_id
     ) THEN
    RAISE EXCEPTION 'carried_from_item_id must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.carried_to_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.campaign_wishlist_items w
       WHERE w.id = NEW.carried_to_item_id
         AND w.organization_id = NEW.organization_id
     ) THEN
    RAISE EXCEPTION 'carried_to_item_id must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pledges_campaign_same_org ON public.pledges;
CREATE TRIGGER pledges_campaign_same_org
  BEFORE INSERT OR UPDATE OF campaign_id, organization_id ON public.pledges
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_same_organization();

DROP TRIGGER IF EXISTS payments_campaign_same_org ON public.payments;
CREATE TRIGGER payments_campaign_same_org
  BEFORE INSERT OR UPDATE OF campaign_id, organization_id ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_same_organization();

DROP TRIGGER IF EXISTS recurring_donation_plans_campaign_same_org ON public.recurring_donation_plans;
CREATE TRIGGER recurring_donation_plans_campaign_same_org
  BEFORE INSERT OR UPDATE OF campaign_id, organization_id ON public.recurring_donation_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_same_organization();

DROP TRIGGER IF EXISTS donation_checkout_sessions_campaign_same_org ON public.donation_checkout_sessions;
CREATE TRIGGER donation_checkout_sessions_campaign_same_org
  BEFORE INSERT OR UPDATE OF campaign_id, organization_id ON public.donation_checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_same_organization();

DROP TRIGGER IF EXISTS pledges_wishlist_same_org ON public.pledges;
CREATE TRIGGER pledges_wishlist_same_org
  BEFORE INSERT OR UPDATE OF wishlist_item_id, organization_id ON public.pledges
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_wishlist_item_same_organization();

DROP TRIGGER IF EXISTS payments_wishlist_same_org ON public.payments;
CREATE TRIGGER payments_wishlist_same_org
  BEFORE INSERT OR UPDATE OF wishlist_item_id, organization_id ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_wishlist_item_same_organization();

DROP TRIGGER IF EXISTS recurring_donation_plans_wishlist_same_org ON public.recurring_donation_plans;
CREATE TRIGGER recurring_donation_plans_wishlist_same_org
  BEFORE INSERT OR UPDATE OF wishlist_item_id, organization_id ON public.recurring_donation_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_wishlist_item_same_organization();

DROP TRIGGER IF EXISTS donation_checkout_sessions_wishlist_same_org ON public.donation_checkout_sessions;
CREATE TRIGGER donation_checkout_sessions_wishlist_same_org
  BEFORE INSERT OR UPDATE OF wishlist_item_id, organization_id ON public.donation_checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_wishlist_item_same_organization();

DROP TRIGGER IF EXISTS campaign_wishlist_items_carry_same_org ON public.campaign_wishlist_items;
CREATE TRIGGER campaign_wishlist_items_carry_same_org
  BEFORE INSERT OR UPDATE OF carried_from_item_id, carried_to_item_id, organization_id
  ON public.campaign_wishlist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_wishlist_carry_same_organization();

DROP POLICY IF EXISTS "Staff view org campaign wishlist items" ON public.campaign_wishlist_items;
DROP POLICY IF EXISTS "Staff insert org campaign wishlist items" ON public.campaign_wishlist_items;
DROP POLICY IF EXISTS "Staff update org campaign wishlist items" ON public.campaign_wishlist_items;
DROP POLICY IF EXISTS "Staff delete org campaign wishlist items" ON public.campaign_wishlist_items;

CREATE POLICY "Staff view org campaign wishlist items"
  ON public.campaign_wishlist_items FOR SELECT
  USING (
    public.auth_user_can_view_donations(organization_id)
    AND public.campaign_belongs_to_org(campaign_id, organization_id)
  );

CREATE POLICY "Staff insert org campaign wishlist items"
  ON public.campaign_wishlist_items FOR INSERT
  WITH CHECK (
    public.auth_user_can_manage_donations(organization_id)
    AND public.campaign_belongs_to_org(campaign_id, organization_id)
  );

CREATE POLICY "Staff update org campaign wishlist items"
  ON public.campaign_wishlist_items FOR UPDATE
  USING (
    public.auth_user_can_manage_donations(organization_id)
    AND public.campaign_belongs_to_org(campaign_id, organization_id)
  )
  WITH CHECK (
    public.auth_user_can_manage_donations(organization_id)
    AND public.campaign_belongs_to_org(campaign_id, organization_id)
  );

CREATE POLICY "Staff delete org campaign wishlist items"
  ON public.campaign_wishlist_items FOR DELETE
  USING (
    public.auth_user_can_manage_donations(organization_id)
    AND public.campaign_belongs_to_org(campaign_id, organization_id)
  );

COMMENT ON CONSTRAINT campaigns_id_organization_id_key ON public.campaigns IS
  'Supports composite FKs so campaign children cannot reference a campaign from another organization.';

COMMENT ON FUNCTION public.campaign_belongs_to_org(uuid, uuid) IS
  'True when the campaign row exists and its organization_id matches.';
