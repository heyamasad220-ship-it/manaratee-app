-- Backfill 72-hour request holds for open submitted/pending rentals that already
-- block the calendar via temporary_hold but have no hold_expires_at.
-- New submits set this in app code; this catches existing open requests.
-- Already-elapsed holds (created_at + 72h <= now) expire on the next hold-expiry cron run.

update public.venue_rentals
set hold_expires_at = created_at + interval '72 hours'
where status in ('submitted', 'pending', 'awaiting_supervisor_approval')
  and hold_expires_at is null
  and created_at is not null;

update public.rental_reservations rr
set hold_expires_at = vr.hold_expires_at
from public.venue_rentals vr
where rr.venue_rental_id = vr.id
  and rr.organization_id = vr.organization_id
  and vr.status in ('submitted', 'pending', 'awaiting_supervisor_approval')
  and vr.hold_expires_at is not null
  and rr.hold_expires_at is null
  and rr.status = 'temporary_hold';
