"use server"

import { revalidatePath } from "next/cache"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"
import type {
  ProgramApplicantType,
  ProgramApplication,
  ProgramApplicationSource,
  ProgramApplicationStatus,
  ProgramApplicationWithDetails,
} from "@/lib/programs/program-application-types"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"

function mapApplication(row: Record<string, unknown>): ProgramApplication {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    program_id: row.program_id as string,
    offering_id: row.offering_id as string,
    approved_offering_id: (row.approved_offering_id as string | null) ?? null,
    registrant_contact_id: (row.registrant_contact_id as string | null) ?? null,
    participant_contact_id: (row.participant_contact_id as string | null) ?? null,
    participant_name: row.participant_name as string,
    applicant_type: row.applicant_type as ProgramApplicantType,
    status: row.status as ProgramApplicationStatus,
    source: row.source as ProgramApplicationSource,
    evaluation_notes: (row.evaluation_notes as string | null) ?? null,
    evaluated_at: (row.evaluated_at as string | null) ?? null,
    evaluated_by_user_id: (row.evaluated_by_user_id as string | null) ?? null,
    enrollment_id: (row.enrollment_id as string | null) ?? null,
    waitlist_id: (row.waitlist_id as string | null) ?? null,
    created_by_user_id: (row.created_by_user_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export type SubmitProgramApplicationInput = {
  organizationId: string
  programId: string
  offeringId: string
  registrantContactId: string
  participantContactId?: string | null
  participantName: string
  applicantType: ProgramApplicantType
  source?: ProgramApplicationSource
  createdByUserId?: string | null
}

/**
 * Create an application. Returning students are auto-approved.
 * New students stay `submitted` until department evaluation.
 */
export async function submitProgramApplication(
  input: SubmitProgramApplicationInput
): Promise<
  | { success: true; application: ProgramApplication }
  | { success: false; error: string }
> {
  const name = input.participantName.trim()
  if (!name) {
    return { success: false, error: "Participant name is required." }
  }

  const supabase = await createClient()

  const { data: offering, error: offeringError } = await supabase
    .from("program_offerings")
    .select("id, program_id, organization_id, status")
    .eq("id", input.offeringId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (offeringError || !offering) {
    return { success: false, error: "Offering not found." }
  }

  if ((offering.program_id as string) !== input.programId) {
    return { success: false, error: "Offering does not belong to this program." }
  }

  const autoApprove = input.applicantType === "returning"
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("program_applications")
    .insert({
      organization_id: input.organizationId,
      program_id: input.programId,
      offering_id: input.offeringId,
      approved_offering_id: autoApprove ? input.offeringId : null,
      registrant_contact_id: input.registrantContactId,
      participant_contact_id: input.participantContactId || null,
      participant_name: name,
      applicant_type: input.applicantType,
      status: autoApprove ? "approved" : "submitted",
      source: input.source ?? "customer",
      evaluated_at: autoApprove ? now : null,
      evaluated_by_user_id: autoApprove
        ? input.createdByUserId || null
        : null,
      evaluation_notes: autoApprove
        ? "Auto-approved returning student."
        : null,
      created_by_user_id: input.createdByUserId || null,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error || !data) {
    console.error("submitProgramApplication:", error?.message)
    return {
      success: false,
      error: error?.message || "Failed to submit application.",
    }
  }

  revalidatePath(`/customer/programs/${input.programId}`)
  revalidatePath(`/customer/programs/${input.programId}/apply`)
  revalidatePath(`/programs/${input.programId}`)

  return { success: true, application: mapApplication(data) }
}

export async function getApplicationsForRegistrantContact(
  organizationId: string,
  registrantContactId: string,
  programId?: string
): Promise<ProgramApplicationWithDetails[]> {
  const supabase = await createClient()

  let query = supabase
    .from("program_applications")
    .select(
      `
      *,
      program:program_id ( name ),
      offering:offering_id ( name ),
      approved_offering:approved_offering_id ( name )
    `
    )
    .eq("organization_id", organizationId)
    .eq("registrant_contact_id", registrantContactId)
    .order("created_at", { ascending: false })

  if (programId) {
    query = query.eq("program_id", programId)
  }

  const { data, error } = await query
  if (error) {
    console.error("getApplicationsForRegistrantContact:", error.message)
    return []
  }

  return (data || []).map((row) => {
    const base = mapApplication(row as Record<string, unknown>)
    const program = row.program as { name?: string } | null
    const offering = row.offering as { name?: string } | null
    const approved = row.approved_offering as { name?: string } | null
    return {
      ...base,
      program_name: program?.name,
      offering_name: offering?.name,
      approved_offering_name: approved?.name ?? null,
    }
  })
}

export async function getSubmittedApplicationsForDepartment(
  departmentId: string
): Promise<ProgramApplicationWithDetails[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)

  if (programsError || !programs?.length) {
    return []
  }

  const programIds = programs.map((row) => row.id as string)
  const programNameById = new Map(
    programs.map((row) => [row.id as string, (row.name as string) || "Program"])
  )

  const { data, error } = await supabase
    .from("program_applications")
    .select(
      `
      *,
      offering:offering_id ( name )
    `
    )
    .eq("organization_id", organizationId)
    .in("program_id", programIds)
    .eq("status", "submitted")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("getSubmittedApplicationsForDepartment:", error.message)
    return []
  }

  return (data || []).map((row) => {
    const base = mapApplication(row as Record<string, unknown>)
    const offering = row.offering as { name?: string } | null
    return {
      ...base,
      program_name: programNameById.get(base.program_id),
      offering_name: offering?.name,
    }
  })
}

export type EvaluateProgramApplicationInput = {
  applicationId: string
  decision: "approved" | "not_approved"
  /** When approving into a different offering. */
  approvedOfferingId?: string | null
  notes?: string | null
  evaluatedByUserId: string
}

export async function evaluateProgramApplication(
  input: EvaluateProgramApplicationInput
): Promise<
  | { success: true; application: ProgramApplication }
  | { success: false; error: string }
> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()

  const { data: existing, error: loadError } = await supabase
    .from("program_applications")
    .select("*")
    .eq("id", input.applicationId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadError || !existing) {
    return { success: false, error: "Application not found." }
  }

  if ((existing.status as string) !== "submitted") {
    return { success: false, error: "Only pending applications can be evaluated." }
  }

  let approvedOfferingId: string | null = null
  if (input.decision === "approved") {
    approvedOfferingId =
      input.approvedOfferingId || (existing.offering_id as string)

    const { data: offering } = await supabase
      .from("program_offerings")
      .select("id, program_id")
      .eq("id", approvedOfferingId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (!offering) {
      return { success: false, error: "Approved offering not found." }
    }

    if ((offering.program_id as string) !== (existing.program_id as string)) {
      return {
        success: false,
        error: "Approved offering must belong to the same program.",
      }
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("program_applications")
    .update({
      status: input.decision,
      approved_offering_id: approvedOfferingId,
      evaluation_notes: input.notes?.trim() || null,
      evaluated_at: now,
      evaluated_by_user_id: input.evaluatedByUserId,
      updated_at: now,
    })
    .eq("id", input.applicationId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error || !data) {
    console.error("evaluateProgramApplication:", error?.message)
    return {
      success: false,
      error: error?.message || "Failed to save evaluation.",
    }
  }

  const { data: program } = await supabase
    .from("programs")
    .select("department_id")
    .eq("id", existing.program_id as string)
    .maybeSingle()

  if (program?.department_id) {
    revalidatePath(
      workforceDepartmentDetailPath(program.department_id as string)
    )
  }
  revalidatePath(`/programs/${existing.program_id as string}`)
  revalidatePath(`/customer/programs/${existing.program_id as string}`)
  revalidatePath(`/customer/programs/${existing.program_id as string}/apply`)

  return { success: true, application: mapApplication(data) }
}

export async function fetchDepartmentApplicationsAction(departmentId: string) {
  try {
    const rows = await getSubmittedApplicationsForDepartment(departmentId)
    return { success: true as const, applications: rows }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load applications.",
    }
  }
}
