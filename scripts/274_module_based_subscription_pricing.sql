-- Module-based tenant subscription pricing.
-- Super Admin sets a monthly price per product module and multi-module discounts.
-- Existing plan rows are kept for history. Current tenant module access is preserved.
-- Existing billed amounts are grandfathered so this script does not change what
-- customers are charged until Super Admin saves a new subscription.
-- Safe to re-run in the Supabase SQL Editor after 273.

DO $$
BEGIN
  -- Canonical integer cents on modules. Older databases may have price_monthly or monthly_price.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'modules'
      AND column_name = 'monthly_price_cents'
  ) THEN
    ALTER TABLE public.modules
      ADD COLUMN monthly_price_cents INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'price_monthly'
  ) THEN
    UPDATE public.modules
    SET monthly_price_cents = ROUND(COALESCE(price_monthly, 0) * 100)::integer
    WHERE COALESCE(monthly_price_cents, 0) = 0
      AND COALESCE(price_monthly, 0) > 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'monthly_price'
  ) THEN
    UPDATE public.modules
    SET monthly_price_cents = ROUND(COALESCE(monthly_price, 0) * 100)::integer
    WHERE COALESCE(monthly_price_cents, 0) = 0
      AND COALESCE(monthly_price, 0) > 0;
  END IF;
END $$;

COMMENT ON COLUMN public.modules.monthly_price_cents IS
  'Monthly product price in integer cents. Source of truth for new tenant subscriptions.';

-- Example starting prices for the six product modules. Super Admin can edit these.
-- Do not overwrite a non-zero price that was already set.
UPDATE public.modules
SET monthly_price_cents = CASE slug
  WHEN 'event-management' THEN 14900
  WHEN 'programs' THEN 14900
  WHEN 'vendor-hub' THEN 4900
  WHEN 'bookings' THEN 9900
  WHEN 'donations' THEN 19900
  WHEN 'membership' THEN 4900
  ELSE monthly_price_cents
END
WHERE slug IN (
  'event-management',
  'programs',
  'vendor-hub',
  'bookings',
  'donations',
  'membership'
)
  AND COALESCE(monthly_price_cents, 0) = 0;

UPDATE public.modules
SET monthly_price_cents = 0
WHERE slug NOT IN (
  'event-management',
  'programs',
  'vendor-hub',
  'bookings',
  'donations',
  'membership'
);

CREATE TABLE IF NOT EXISTS public.module_discount_rules (
  module_count INTEGER PRIMARY KEY CHECK (module_count >= 1 AND module_count <= 6),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.module_discount_rules IS
  'Percent off the module subtotal when an organization subscribes to this many product modules.';

INSERT INTO public.module_discount_rules (module_count, discount_percent, is_active)
VALUES
  (1, 0, true),
  (2, 5, true),
  (3, 10, true),
  (4, 10, true),
  (5, 15, true),
  (6, 20, true)
ON CONFLICT (module_count) DO NOTHING;

ALTER TABLE public.module_discount_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS module_discount_rules_select ON public.module_discount_rules;
CREATE POLICY module_discount_rules_select
  ON public.module_discount_rules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  selected_product_slugs TEXT[] NOT NULL DEFAULT '{}',
  module_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_amount_cents INTEGER NOT NULL DEFAULT 0,
  calculated_monthly_cents INTEGER NOT NULL DEFAULT 0,
  custom_monthly_cents INTEGER,
  billed_monthly_cents INTEGER NOT NULL DEFAULT 0,
  is_price_locked BOOLEAN NOT NULL DEFAULT false,
  billing_interval TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'annual')),
  billing_status TEXT NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT,
  next_billing_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS selected_product_slugs TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON TABLE public.organization_subscriptions IS
  'Current tenant subscription snapshot. Historical invoices stay on organization_billing_invoices.';
COMMENT ON COLUMN public.organization_subscriptions.custom_monthly_cents IS
  'Optional Super Admin override in cents. When set, billed_monthly_cents uses this value.';
COMMENT ON COLUMN public.organization_subscriptions.is_price_locked IS
  'When true, billed_monthly_cents stays at the grandfathered/custom amount until Super Admin saves a new price.';
COMMENT ON COLUMN public.organization_subscriptions.billing_interval IS
  'Reserved for a future annual discount. Multi-module discount stays separate.';

CREATE INDEX IF NOT EXISTS organization_subscriptions_status_idx
  ON public.organization_subscriptions (billing_status);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_subscriptions_select ON public.organization_subscriptions;
CREATE POLICY organization_subscriptions_select
  ON public.organization_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_modules'
      AND column_name = 'enabled_at'
  ) THEN
    ALTER TABLE public.organization_modules
      ADD COLUMN enabled_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_modules'
      AND column_name = 'disabled_at'
  ) THEN
    ALTER TABLE public.organization_modules
      ADD COLUMN disabled_at TIMESTAMPTZ;
  END IF;
END $$;

UPDATE public.organization_modules
SET enabled_at = COALESCE(enabled_at, created_at, NOW())
WHERE enabled = true
  AND enabled_at IS NULL;

-- Grandfather existing tenants: keep current modules and lock the current plan price.
INSERT INTO public.organization_subscriptions (
  organization_id,
  selected_product_slugs,
  module_subtotal_cents,
  discount_percent,
  discount_amount_cents,
  calculated_monthly_cents,
  custom_monthly_cents,
  billed_monthly_cents,
  is_price_locked,
  billing_interval,
  billing_status
)
SELECT
  o.id,
  COALESCE((
    SELECT array_agg(m.slug ORDER BY m.slug)
    FROM public.organization_modules om
    JOIN public.modules m ON m.id = om.module_id
    WHERE om.organization_id = o.id
      AND om.enabled = true
      AND m.slug IN (
        'event-management',
        'programs',
        'vendor-hub',
        'bookings',
        'donations',
        'membership'
      )
  ), '{}'::text[]),
  0,
  0,
  0,
  COALESCE(ROUND(p.monthly_price * 100)::integer, 0),
  COALESCE(ROUND(p.monthly_price * 100)::integer, 0),
  COALESCE(ROUND(p.monthly_price * 100)::integer, 0),
  CASE WHEN p.id IS NOT NULL THEN true ELSE false END,
  'monthly',
  'active'
FROM public.organizations o
LEFT JOIN public.plans p ON p.id = o.plan_id
ON CONFLICT (organization_id) DO NOTHING;

-- default_enabled is deprecated. Leave the column so older scripts still run.
-- New tenants must receive product modules only from Super Admin selection.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'modules'
      AND column_name = 'default_enabled'
  ) THEN
    COMMENT ON COLUMN public.modules.default_enabled IS
      'Deprecated. Product modules are no longer auto-enabled for new tenants.';
  END IF;
END $$;
