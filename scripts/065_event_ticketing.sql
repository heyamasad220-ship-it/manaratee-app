-- Event ticketing: ticket types and orders linked to internal_events
-- Run after 064_service_participations.sql

ALTER TABLE public.internal_events
  ADD COLUMN IF NOT EXISTS requires_ticketing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticketing_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.internal_events.requires_ticketing IS
  'When true, this event sells tickets (dinners, seminars, galas, etc.).';

COMMENT ON COLUMN public.internal_events.ticketing_config IS
  'Sales window, currency, and checkout settings for this event.';

CREATE TABLE IF NOT EXISTS public.event_ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  internal_event_id UUID NOT NULL REFERENCES public.internal_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  quantity_total INTEGER CHECK (quantity_total IS NULL OR quantity_total >= 0),
  quantity_sold INTEGER NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  sales_start_at TIMESTAMPTZ,
  sales_end_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_ticket_types_org_event_idx
  ON public.event_ticket_types(organization_id, internal_event_id);

CREATE TABLE IF NOT EXISTS public.ticket_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  internal_event_id UUID NOT NULL REFERENCES public.internal_events(id) ON DELETE RESTRICT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'canceled', 'refunded', 'partially_refunded')),
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT,
  payment_reference TEXT,
  purchaser_name TEXT,
  purchaser_email TEXT NOT NULL,
  billing_address JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, order_number)
);

CREATE INDEX IF NOT EXISTS ticket_orders_org_event_idx
  ON public.ticket_orders(organization_id, internal_event_id);

CREATE INDEX IF NOT EXISTS ticket_orders_org_created_idx
  ON public.ticket_orders(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ticket_order_id UUID NOT NULL REFERENCES public.ticket_orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.event_ticket_types(id) ON DELETE RESTRICT,
  internal_event_id UUID NOT NULL REFERENCES public.internal_events(id) ON DELETE RESTRICT,
  ticket_code TEXT NOT NULL,
  attendee_name TEXT,
  attendee_email TEXT,
  status TEXT NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'checked_in', 'canceled', 'refunded')),
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, ticket_code)
);

CREATE INDEX IF NOT EXISTS tickets_org_event_idx
  ON public.tickets(organization_id, internal_event_id);

CREATE INDEX IF NOT EXISTS tickets_org_order_idx
  ON public.tickets(organization_id, ticket_order_id);

ALTER TABLE public.event_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage event ticket types" ON public.event_ticket_types;
CREATE POLICY "Org members manage event ticket types"
  ON public.event_ticket_types FOR ALL
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

DROP POLICY IF EXISTS "Org members manage ticket orders" ON public.ticket_orders;
CREATE POLICY "Org members manage ticket orders"
  ON public.ticket_orders FOR ALL
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

DROP POLICY IF EXISTS "Org members manage tickets" ON public.tickets;
CREATE POLICY "Org members manage tickets"
  ON public.tickets FOR ALL
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

DROP TRIGGER IF EXISTS event_ticket_types_updated_at ON public.event_ticket_types;
CREATE TRIGGER event_ticket_types_updated_at
  BEFORE UPDATE ON public.event_ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS ticket_orders_updated_at ON public.ticket_orders;
CREATE TRIGGER ticket_orders_updated_at
  BEFORE UPDATE ON public.ticket_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
