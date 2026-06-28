-- Grant execute on donor giving RPCs to app roles (required for People donor filter + reports).
-- Run after 127, 128, and 129.

GRANT EXECUTE ON FUNCTION public.donation_donor_giving_report(
  uuid, date, date, text, text, text, boolean, text, boolean, integer, integer
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.donation_donor_giving_report_summary(
  uuid, date, date, text, text, text, boolean
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.search_donor_giving_contact_ids(
  uuid, text, text, text, integer, integer
) TO authenticated, service_role;
