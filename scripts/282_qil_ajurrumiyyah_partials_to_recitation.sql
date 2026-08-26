-- Al-Ajurrumiyyah is a free course. Partial payments that were sitting on
-- other QIL offerings (and showed up next to that class in Payment Summary)
-- are parked on Recitation Improvement so the offering name can be corrected later.
-- Payments stay on the enrollment. $0 Al-Ajurrumiyyah seats are left alone.
--
-- Meriem Douma: Tajweed (Beginner) $225 / $25 → Recitation Improvement
-- Narmeen Alfahal: Tajweed (Advanced) $450 / $50 → Recitation Improvement
-- Sana Hamdan is already on Recitation Improvement.

DO $$
DECLARE
  dest_id uuid := '3510a274-049e-4427-985c-c267e9a12a0a';
  dest_name text;
  moved_on text := to_char(NOW(), 'Mon FMDD, YYYY');
BEGIN
  SELECT name INTO dest_name
  FROM public.program_offerings
  WHERE id = dest_id;

  IF dest_name IS NULL THEN
    RAISE EXCEPTION 'Recitation Improvement offering % not found', dest_id;
  END IF;

  UPDATE public.program_enrollments e
  SET
    offering_id = dest_id,
    notes = CASE
      WHEN coalesce(trim(e.notes), '') = '' THEN
        'Moved from ' || o.name || ' to ' || dest_name || ' on ' || moved_on || '.'
      ELSE
        trim(e.notes) || E'\nMoved from ' || o.name || ' to ' || dest_name || ' on ' || moved_on || '.'
    END,
    updated_at = NOW()
  FROM public.program_offerings o
  WHERE e.id IN (
      '38b87566-265d-4eb4-945d-14ed282bda15',
      '81d41b55-0470-4b7b-b7ac-b0bfd4772d61'
    )
    AND o.id = e.offering_id
    AND e.offering_id IS DISTINCT FROM dest_id
    AND e.status NOT IN ('cancelled', 'withdrawn', 'transferred', 'expired');

  UPDATE public.program_charges
  SET offering_id = dest_id
  WHERE enrollment_id IN (
      '38b87566-265d-4eb4-945d-14ed282bda15',
      '81d41b55-0470-4b7b-b7ac-b0bfd4772d61'
    )
    AND offering_id IS DISTINCT FROM dest_id;

  UPDATE public.program_applications
  SET
    offering_id = dest_id,
    updated_at = NOW()
  WHERE enrollment_id IN (
      '38b87566-265d-4eb4-945d-14ed282bda15',
      '81d41b55-0470-4b7b-b7ac-b0bfd4772d61'
    )
    AND offering_id IS DISTINCT FROM dest_id;

  UPDATE public.program_enrollment_fa_awards
  SET offering_id = dest_id
  WHERE enrollment_id IN (
      '38b87566-265d-4eb4-945d-14ed282bda15',
      '81d41b55-0470-4b7b-b7ac-b0bfd4772d61'
    )
    AND offering_id IS DISTINCT FROM dest_id;

  DELETE FROM public.program_registration_session_access
  WHERE enrollment_id IN (
      '38b87566-265d-4eb4-945d-14ed282bda15',
      '81d41b55-0470-4b7b-b7ac-b0bfd4772d61'
    );
END $$;
