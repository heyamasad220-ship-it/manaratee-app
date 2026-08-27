-- Move Eventbrite purchaser contact details off kid/attendee seats.
-- Attendee keeps the ticket-holder name. Email/phone belong on the order contact.

UPDATE public.tickets t
SET attendee_email = NULL
FROM public.ticket_orders o
WHERE t.ticket_order_id = o.id
  AND t.attendee_email IS NOT NULL
  AND o.purchaser_email IS NOT NULL
  AND lower(trim(t.attendee_email)) = lower(trim(o.purchaser_email));
