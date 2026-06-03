import { createClient } from "@/lib/supabase/server"
import { getSessionAccessForEnrollment } from "@/lib/programs/program-registration-session-access"

export async function getEnrollmentRegistrationDetail(
  registrationId: string,
  organizationId: string
) {
  const supabase = await createClient()

  const { data: enrollment, error } = await supabase
    .from("program_enrollments")
    .select(
      `
      id,
      organization_id,
      program_id,
      offering_id,
      department_id,
      registration_option_id,
      charge_id,
      participant_contact_id,
      registrant_contact_id,
      payer_contact_id,
      participant_type,
      registrant_type,
      child_name,
      child_age,
      parent_name,
      parent_email,
      parent_phone,
      session_name,
      weeks,
      enrollment_date,
      status,
      payment_status,
      payment_required,
      amount_paid,
      total_amount,
      before_care,
      after_care,
      lunch_type,
      notes,
      quote_snapshot,
      checkout_expires_at,
      created_at,
      updated_at,
      programs:program_id (
        id,
        name,
        description,
        start_date,
        end_date,
        capacity,
        enrolled,
        waitlist,
        status
      ),
      program_offerings:offering_id (
        id,
        name,
        offering_type,
        status
      ),
      program_registration_options:registration_option_id (
        id,
        name,
        option_type
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("id", registrationId)
    .maybeSingle()

  if (error || !enrollment) {
    return null
  }

  const [sessionAccess, statusHistory, lifecycleEvents] = await Promise.all([
    getSessionAccessForEnrollment(registrationId, organizationId),
    supabase
      .from("program_enrollment_status_history")
      .select(
        "id, from_status, to_status, reason, actor_type, actor_user_id, created_at"
      )
      .eq("organization_id", organizationId)
      .eq("enrollment_id", registrationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("program_registration_lifecycle_events")
      .select("id, action, actor_type, actor_user_id, payload, created_at")
      .eq("organization_id", organizationId)
      .eq("enrollment_id", registrationId)
      .order("created_at", { ascending: false }),
  ])

  return {
    enrollment,
    sessionAccess,
    statusHistory: statusHistory.data || [],
    lifecycleEvents: lifecycleEvents.data || [],
  }
}
