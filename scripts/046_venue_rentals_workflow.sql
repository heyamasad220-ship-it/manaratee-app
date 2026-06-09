-- Venue Rentals workflow foundation
-- Run after 045_venues_spaces_management.sql
-- Safe to re-run. Does NOT drop venue_bookings (legacy customer flow remains).

-- ---------------------------------------------------------------------------
-- Extend shared reservation engine
-- ---------------------------------------------------------------------------
ALTER TABLE public.resource_reservations
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS resource_reservations_org_venue_range_idx
  ON public.resource_reservations(organization_id, venue_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS resource_reservations_hold_expires_idx
  ON public.resource_reservations(hold_expires_at)
  WHERE hold_expires_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- venue_rentals (canonical rental request)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  venue_rental_event_type_id UUID REFERENCES public.venue_rental_event_types(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'submitted',
      'awaiting_supervisor_approval',
      'declined',
      'approved_pending_payment',
      'hold_expired',
      'deposit_paid',
      'security_deposit_paid',
      'confirmed',
      'cancelled_before_payment',
      'cancelled_after_payment',
      'completed',
      'awaiting_security_deposit_refund_approval',
      'security_deposit_refunded',
      'closed'
    )
  ),
  notes TEXT,
  supervisor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  hold_expires_at TIMESTAMPTZ,
  payment_notice_sent_at TIMESTAMPTZ,
  event_reminder_sent_at TIMESTAMPTZ,
  inspection_completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS venue_rentals_org_status_idx
  ON public.venue_rentals(organization_id, status);

CREATE INDEX IF NOT EXISTS venue_rentals_org_customer_idx
  ON public.venue_rentals(organization_id, customer_user_id);

CREATE INDEX IF NOT EXISTS venue_rentals_hold_expires_idx
  ON public.venue_rentals(hold_expires_at)
  WHERE hold_expires_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- rental_reservations (one row per space/time block on a rental)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_rental_id UUID NOT NULL REFERENCES public.venue_rentals(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'temporary_hold' CHECK (
    status IN ('temporary_hold', 'confirmed', 'cancelled', 'expired', 'blocked')
  ),
  hold_expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS rental_reservations_org_rental_idx
  ON public.rental_reservations(organization_id, venue_rental_id);

CREATE INDEX IF NOT EXISTS rental_reservations_org_venue_range_idx
  ON public.rental_reservations(organization_id, venue_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS rental_reservations_hold_expires_idx
  ON public.rental_reservations(hold_expires_at)
  WHERE hold_expires_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- rental_payments (deposit, security deposit, balance, addons, refunds)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_rental_id UUID NOT NULL REFERENCES public.venue_rentals(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (
    payment_type IN ('deposit', 'security_deposit', 'remaining_balance', 'addon_fee', 'refund')
  ),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (
    status IN (
      'unpaid',
      'payment_requested',
      'paid_manually',
      'paid_stripe_later',
      'refunded'
    )
  ),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_payments_org_rental_idx
  ON public.rental_payments(organization_id, venue_rental_id);

CREATE INDEX IF NOT EXISTS rental_payments_org_status_idx
  ON public.rental_payments(organization_id, status);

-- ---------------------------------------------------------------------------
-- rental_contracts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_rental_id UUID NOT NULL REFERENCES public.venue_rentals(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (
    status IN ('generated', 'sent', 'signed', 'voided')
  ),
  document_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rental_contracts_org_rental_idx
  ON public.rental_contracts(organization_id, venue_rental_id);

-- ---------------------------------------------------------------------------
-- rental_addons (catalog) + rental_selected_addons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  default_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.rental_selected_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_rental_id UUID NOT NULL REFERENCES public.venue_rentals(id) ON DELETE CASCADE,
  rental_addon_id UUID NOT NULL REFERENCES public.rental_addons(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_rental_id, rental_addon_id)
);

CREATE INDEX IF NOT EXISTS rental_selected_addons_org_rental_idx
  ON public.rental_selected_addons(organization_id, venue_rental_id);

-- ---------------------------------------------------------------------------
-- rental_space_pricing (by space, day of week, time block — not guest count)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rental_space_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  flat_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (flat_price >= 0),
  hourly_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (hourly_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS rental_space_pricing_org_venue_day_idx
  ON public.rental_space_pricing(organization_id, venue_id, day_of_week);

-- ---------------------------------------------------------------------------
-- reservation_override_logs (staff force-book / conflict override audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_override_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_reservation_id UUID REFERENCES public.resource_reservations(id) ON DELETE SET NULL,
  venue_rental_id UUID REFERENCES public.venue_rentals(id) ON DELETE SET NULL,
  rental_reservation_id UUID REFERENCES public.rental_reservations(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reservation_override_logs_org_created_idx
  ON public.reservation_override_logs(organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.venue_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_selected_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_space_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_override_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage venue rentals" ON public.venue_rentals;
CREATE POLICY "Org members manage venue rentals"
  ON public.venue_rentals FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers view own venue rentals" ON public.venue_rentals;
CREATE POLICY "Customers view own venue rentals"
  ON public.venue_rentals FOR SELECT
  USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers insert own venue rentals" ON public.venue_rentals;
CREATE POLICY "Customers insert own venue rentals"
  ON public.venue_rentals FOR INSERT
  WITH CHECK (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Org members manage rental reservations" ON public.rental_reservations;
CREATE POLICY "Org members manage rental reservations"
  ON public.rental_reservations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage rental payments" ON public.rental_payments;
CREATE POLICY "Org members manage rental payments"
  ON public.rental_payments FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage rental contracts" ON public.rental_contracts;
CREATE POLICY "Org members manage rental contracts"
  ON public.rental_contracts FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage rental addons" ON public.rental_addons;
CREATE POLICY "Org members manage rental addons"
  ON public.rental_addons FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage rental selected addons" ON public.rental_selected_addons;
CREATE POLICY "Org members manage rental selected addons"
  ON public.rental_selected_addons FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage rental space pricing" ON public.rental_space_pricing;
CREATE POLICY "Org members manage rental space pricing"
  ON public.rental_space_pricing FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members manage reservation override logs" ON public.reservation_override_logs;
CREATE POLICY "Org members manage reservation override logs"
  ON public.reservation_override_logs FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS venue_rentals_updated_at ON public.venue_rentals;
CREATE TRIGGER venue_rentals_updated_at
  BEFORE UPDATE ON public.venue_rentals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS rental_reservations_updated_at ON public.rental_reservations;
CREATE TRIGGER rental_reservations_updated_at
  BEFORE UPDATE ON public.rental_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS rental_payments_updated_at ON public.rental_payments;
CREATE TRIGGER rental_payments_updated_at
  BEFORE UPDATE ON public.rental_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS rental_contracts_updated_at ON public.rental_contracts;
CREATE TRIGGER rental_contracts_updated_at
  BEFORE UPDATE ON public.rental_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS rental_addons_updated_at ON public.rental_addons;
CREATE TRIGGER rental_addons_updated_at
  BEFORE UPDATE ON public.rental_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS rental_space_pricing_updated_at ON public.rental_space_pricing;
CREATE TRIGGER rental_space_pricing_updated_at
  BEFORE UPDATE ON public.rental_space_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Seed default rental add-ons per organization
-- ---------------------------------------------------------------------------
INSERT INTO public.rental_addons (organization_id, name, slug, sort_order)
SELECT o.id, v.name, v.slug, v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Table Covers', 'table-covers', 10),
    ('Linens', 'linens', 20),
    ('Cleanup Fee', 'cleanup-fee', 30),
    ('Sound System', 'sound-system', 40),
    ('Projector', 'projector', 50),
    ('Coffee', 'coffee', 60),
    ('Food', 'food', 70)
) AS v(name, slug, sort_order)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sync rental_reservations → resource_reservations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_rental_reservation_to_resource()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'venue_rental' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.status IN ('cancelled', 'expired') THEN
    DELETE FROM public.resource_reservations
    WHERE source_type = 'venue_rental' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.resource_reservations (
    organization_id,
    venue_id,
    space_label,
    title,
    description,
    start_at,
    end_at,
    source_type,
    source_id,
    status,
    hold_expires_at,
    created_by,
    metadata
  )
  VALUES (
    NEW.organization_id,
    NEW.venue_id,
    NULL,
    'Venue Rental Hold',
    NULL,
    NEW.start_at,
    NEW.end_at,
    'venue_rental',
    NEW.id,
    NEW.status,
    NEW.hold_expires_at,
    NEW.created_by,
    jsonb_build_object('venue_rental_id', NEW.venue_rental_id)
  )
  ON CONFLICT (organization_id, source_type, source_id)
  WHERE source_id IS NOT NULL
  DO UPDATE SET
    venue_id = EXCLUDED.venue_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    status = EXCLUDED.status,
    hold_expires_at = EXCLUDED.hold_expires_at,
    created_by = EXCLUDED.created_by,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rental_reservations_resource_sync ON public.rental_reservations;
CREATE TRIGGER rental_reservations_resource_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.rental_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rental_reservation_to_resource();

-- ---------------------------------------------------------------------------
-- Conflict check helper (tenant + space + overlapping blocking statuses)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rental_space_has_conflict(
  p_organization_id UUID,
  p_venue_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_exclude_rental_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resource_reservations rr
    WHERE rr.organization_id = p_organization_id
      AND rr.venue_id = p_venue_id
      AND rr.start_at < p_end_at
      AND rr.end_at > p_start_at
      AND (
        rr.status IN ('temporary_hold', 'confirmed', 'blocked')
        OR rr.status IN (
          'active', 'pending_review', 'approved', 'deposit_pending',
          'deposit_paid', 'fully_paid', 'scheduled', 'draft'
        )
      )
      AND (p_exclude_rental_reservation_id IS NULL OR rr.source_id IS DISTINCT FROM p_exclude_rental_reservation_id)
  );
$$;
