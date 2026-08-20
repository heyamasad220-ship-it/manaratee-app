-- Customer portal SELECT on own ticket orders and tickets.
-- Run after 255_ticket_order_stripe.sql. Safe to re-run.
-- App queries still use service role after verifying the signed-in contact.

DROP POLICY IF EXISTS "Customers view own ticket orders" ON public.ticket_orders;
CREATE POLICY "Customers view own ticket orders"
  ON public.ticket_orders FOR SELECT
  USING (
    contact_id IN (SELECT public.auth_user_contact_ids())
  );

DROP POLICY IF EXISTS "Customers view own tickets" ON public.tickets;
CREATE POLICY "Customers view own tickets"
  ON public.tickets FOR SELECT
  USING (
    ticket_order_id IN (
      SELECT id FROM public.ticket_orders
      WHERE contact_id IN (SELECT public.auth_user_contact_ids())
    )
  );

NOTIFY pgrst, 'reload schema';
