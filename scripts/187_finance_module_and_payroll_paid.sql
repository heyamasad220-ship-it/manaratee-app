-- Finance product module + paid status on department payroll entries.
-- Safe to re-run in Supabase SQL Editor after 171 / 186.

-- ---------------------------------------------------------------------------
-- 1) Payroll status: approved → paid (Finance processes payment)
-- ---------------------------------------------------------------------------
ALTER TABLE public.department_staff_pay_entries
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by_user_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'department_staff_pay_entries_status_check'
  ) THEN
    ALTER TABLE public.department_staff_pay_entries
      DROP CONSTRAINT department_staff_pay_entries_status_check;
  END IF;

  ALTER TABLE public.department_staff_pay_entries
    ADD CONSTRAINT department_staff_pay_entries_status_check
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'paid'));
END $$;

COMMENT ON COLUMN public.department_staff_pay_entries.status IS
  'draft → pending → approved|rejected; Finance marks approved as paid after disbursement.';
COMMENT ON COLUMN public.department_staff_pay_entries.paid_at IS
  'When Finance marked the pay entry as paid.';

-- ---------------------------------------------------------------------------
-- 2) Finance product module (sidebar)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'slug'
  ) THEN
    RAISE NOTICE 'modules.slug missing — aborting finance module seed';
    RETURN;
  END IF;

  UPDATE public.modules
  SET
    name = 'Finance',
    route = '/finance/payroll',
    icon_name = 'Wallet',
    group_name = 'Financial',
    sort_order = 35,
    is_active = true,
    default_enabled = true
  WHERE slug = 'finance';

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'price_monthly'
    ) THEN
      INSERT INTO public.modules (
        code, name, slug, description, route, icon_name, group_name, sort_order,
        is_core, is_active, default_enabled, price_monthly, price_yearly
      )
      VALUES (
        'finance', 'Finance', 'finance',
        'Org payroll queue, payouts, and related finance operations (not SaaS subscription Billing)',
        '/finance/payroll', 'Wallet', 'Financial', 35,
        false, true, true, 0, 0
      );
    ELSE
      INSERT INTO public.modules (
        code, name, slug, description, route, icon_name, group_name, sort_order,
        is_core, is_active, default_enabled
      )
      VALUES (
        'finance', 'Finance', 'finance',
        'Org payroll queue, payouts, and related finance operations (not SaaS subscription Billing)',
        '/finance/payroll', 'Wallet', 'Financial', 35,
        false, true, true
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'include_in_catalog'
  ) THEN
    UPDATE public.modules
    SET include_in_catalog = true
    WHERE slug = 'finance';
  END IF;
END $$;

-- Enable Finance for orgs that already have workforce/HR or donations enabled.
INSERT INTO public.organization_modules (organization_id, module_id, enabled, enabled_by_plan, manually_overridden)
SELECT DISTINCT om.organization_id, m.id, true, true, true
FROM public.organization_modules om
JOIN public.modules seed ON seed.id = om.module_id
  AND seed.slug IN ('workforce', 'hr', 'donations')
  AND om.enabled = true
JOIN public.modules m ON m.slug = 'finance'
ON CONFLICT (organization_id, module_id)
DO UPDATE SET
  enabled = true,
  enabled_by_plan = COALESCE(public.organization_modules.enabled_by_plan, true),
  manually_overridden = true;

-- Seed finance permissions for Admin / Super Admin / Owner when missing.
INSERT INTO public.role_permissions (organization_id, role_id, permission_key, enabled)
SELECT r.organization_id, r.id, p.permission_key, true
FROM public.organization_roles r
CROSS JOIN (
  VALUES ('finance.view'), ('finance.manage')
) AS p(permission_key)
WHERE lower(r.name) IN ('admin', 'super admin', 'owner')
ON CONFLICT (role_id, permission_key)
DO UPDATE SET enabled = EXCLUDED.enabled;
