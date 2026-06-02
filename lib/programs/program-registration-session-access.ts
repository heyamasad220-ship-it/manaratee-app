import { createClient } from "@/lib/supabase/server"
import type { SessionAccessStatus } from "@/lib/programs/program-registration-option-types"

export async function getSessionAccessForEnrollment(
  enrollmentId: string,
  organizationId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_registration_session_access")
    .select(
      `
      id,
      organization_id,
      enrollment_id,
      session_id,
      access_status,
      created_at,
      updated_at,
      program_sessions:session_id (
        id,
        name,
        start_date,
        end_date,
        price
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("enrollment_id", enrollmentId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("getSessionAccessForEnrollment:", error.message)
    return []
  }

  return data || []
}

export async function createSessionAccessRows(input: {
  organizationId: string
  enrollmentId: string
  sessionIds: string[]
  accessStatus?: SessionAccessStatus
}) {
  if (input.sessionIds.length === 0) {
    return
  }

  const supabase = await createClient()
  const uniqueSessionIds = [...new Set(input.sessionIds)]
  const accessStatus = input.accessStatus ?? "active"

  const rows = uniqueSessionIds.map((sessionId) => ({
    organization_id: input.organizationId,
    enrollment_id: input.enrollmentId,
    session_id: sessionId,
    access_status: accessStatus,
  }))

  const { error } = await supabase
    .from("program_registration_session_access")
    .upsert(rows, {
      onConflict: "organization_id,enrollment_id,session_id",
      ignoreDuplicates: false,
    })

  if (error) {
    console.error("createSessionAccessRows:", error)
    throw new Error(error.message)
  }
}

export async function getActiveSessionIdsForOffering(
  offeringId: string,
  organizationId: string,
  programId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_sessions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .eq("offering_id", offeringId)
    .eq("status", "active")

  if (error) {
    console.error("getActiveSessionIdsForOffering:", error.message)
    return []
  }

  const offeringSessionIds = (data || []).map((row) => row.id as string)

  if (offeringSessionIds.length > 0) {
    return offeringSessionIds
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("program_sessions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .eq("status", "active")

  if (fallbackError) {
    console.error("getActiveSessionIdsForOffering fallback:", fallbackError.message)
    return []
  }

  return (fallbackData || []).map((row) => row.id as string)
}
