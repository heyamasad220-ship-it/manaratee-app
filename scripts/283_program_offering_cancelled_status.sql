-- Allow staff to cancel an offering when it does not get enough registrations.
-- cancelled is distinct from closed (registration window ended) and archived (historical).

ALTER TABLE public.program_offerings
  DROP CONSTRAINT IF EXISTS program_offerings_status_check;

ALTER TABLE public.program_offerings
  ADD CONSTRAINT program_offerings_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'draft'::text,
        'active'::text,
        'closed'::text,
        'archived'::text,
        'cancelled'::text
      ]
    )
  );

COMMENT ON COLUMN public.program_offerings.status IS
  'draft | active | closed | archived | cancelled. cancelled = class called off (not enough registrations).';
