"use server"

import { revalidatePath } from "next/cache"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type {
  ProgramApplicantType,
  ProgramApplication,
  ProgramApplicationAnswers,
  ProgramApplicationSource,
  ProgramApplicationStatus,
  ProgramApplicationWithDetails,
  DepartmentApplicationListFilter,
} from "@/lib/programs/program-application-types"
import {
  EMPTY_PROGRAM_APPLICATION_ANSWERS,
  EVALUATION_APPLICATION_STATUSES,
  normalizeProgramApplicationAnswers,
} from "@/lib/programs/program-application-types"
import { DEPARTMENT_WORKSPACE_PROGRAM_STATUSES } from "@/lib/departments/department-active-programs"
import { canManageDepartment } from "@/lib/departments/department-access"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"

function profileDisplayName(profile: {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}) {
  const parts = [profile.first_name, profile.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
  return parts || String(profile.email || "").trim() || null
}

async function resolveUserDisplayNames(
  userIds: string[]
): Promise<Map<string, string>> {
  const nameByUserId = new Map<string, string>()
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return nameByUserId

  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", ids)

  for (const profile of profiles || []) {
    const label = profileDisplayName(profile)
    if (label) nameByUserId.set(profile.id as string, label)
  }

  const missing = ids.filter((id) => !nameByUserId.has(id))
  if (missing.length === 0) return nameByUserId

  try {
    const admin = createServiceRoleClient()
    const { data: adminProfiles } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", missing)
    for (const profile of adminProfiles || []) {
      const label = profileDisplayName(profile)
      if (label) nameByUserId.set(profile.id as string, label)
    }
  } catch (error) {
    console.error("resolveUserDisplayNames service role:", error)
  }

  for (const id of missing) {
    if (!nameByUserId.has(id)) nameByUserId.set(id, "Staff")
  }

  return nameByUserId
}

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
    application_answers: normalizeProgramApplicationAnswers(
      row.application_answers
    ),
    evaluation_notes: (row.evaluation_notes as string | null) ?? null,
    evaluated_at: (row.evaluated_at as string | null) ?? null,
    evaluated_by_user_id: (row.evaluated_by_user_id as string | null) ?? null,
    enrollment_id: (row.enrollment_id as string | null) ?? null,
    waitlist_id: (row.waitlist_id as string | null) ?? null,
    created_by_user_id: (row.created_by_user_id as string | null) ?? null,
    updated_by_user_id: (row.updated_by_user_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function sanitizeAnswersForStorage(
  answers: ProgramApplicationAnswers | null | undefined,
  applicantType: ProgramApplicantType
): ProgramApplicationAnswers {
  const normalized = normalizeProgramApplicationAnswers(answers)
  const requested =
    normalized.requested_offering_ids &&
    normalized.requested_offering_ids.length > 0
      ? [...new Set(normalized.requested_offering_ids)]
      : null
  if (applicantType !== "new") {
    return {
      ...EMPTY_PROGRAM_APPLICATION_ANSWERS,
      needs_babysitter: normalized.needs_babysitter,
      payment_preference: normalized.payment_preference,
      requested_offering_ids: requested,
    }
  }
  return {
    previous_courses: normalized.previous_courses?.trim() || null,
    previous_certificates: normalized.previous_certificates?.trim() || null,
    prior_background: normalized.prior_background,
    prior_center_name:
      normalized.prior_background === "moving_from_another_center"
        ? normalized.prior_center_name?.trim() || null
        : null,
    needs_babysitter: normalized.needs_babysitter,
    payment_preference: normalized.payment_preference,
    requested_offering_ids: requested,
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
  answers?: ProgramApplicationAnswers | null
  source?: ProgramApplicationSource
  createdByUserId?: string | null
}

/**
 * Create an application. All applicants (new and returning) stay `submitted`
 * until a department director evaluates them.
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

  const now = new Date().toISOString()
  const applicationAnswers = sanitizeAnswersForStorage(
    input.answers,
    input.applicantType
  )

  const { data, error } = await supabase
    .from("program_applications")
    .insert({
      organization_id: input.organizationId,
      program_id: input.programId,
      offering_id: input.offeringId,
      approved_offering_id: null,
      registrant_contact_id: input.registrantContactId,
      participant_contact_id: input.participantContactId || null,
      participant_name: name,
      applicant_type: input.applicantType,
      status: "submitted",
      source: input.source ?? "customer",
      application_answers: applicationAnswers,
      evaluated_at: null,
      evaluated_by_user_id: null,
      evaluation_notes: null,
      created_by_user_id: input.createdByUserId || null,
      updated_by_user_id: input.createdByUserId || null,
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

  const { data: program } = await supabase
    .from("programs")
    .select("department_id")
    .eq("id", input.programId)
    .maybeSingle()

  if (program?.department_id) {
    revalidatePath(
      workforceDepartmentDetailPath(program.department_id as string)
    )
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

/**
 * Department Students stages:
 * - submitted → needs review
 * - approved_pending_registration → approved, no enrollment yet
 */
export async function getDepartmentApplications(
  departmentId: string,
  filter: DepartmentApplicationListFilter = "all",
  options?: { programId?: string | null }
): Promise<ProgramApplicationWithDetails[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const supabase = await createClient()

  // Open years only — archived-year applications belong under Archive reports.
  let programsQuery = supabase
    .from("programs")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", [...DEPARTMENT_WORKSPACE_PROGRAM_STATUSES])

  if (options?.programId) {
    programsQuery = programsQuery.eq("id", options.programId)
  }

  const { data: programs, error: programsError } = await programsQuery

  if (programsError || !programs?.length) {
    return []
  }

  const programIds = programs.map((row) => row.id as string)
  const programNameById = new Map(
    programs.map((row) => [row.id as string, (row.name as string) || "Program"])
  )

  let query = supabase
    .from("program_applications")
    .select(
      `
      *,
      offering:offering_id ( name ),
      approved_offering:approved_offering_id ( name )
    `
    )
    .eq("organization_id", organizationId)
    .in("program_id", programIds)
    .order("created_at", { ascending: false })

  if (filter === "submitted" || filter === "needs_review") {
    query = query.eq("status", "submitted")
  } else if (filter === "evaluation") {
    query = query.in("status", [...EVALUATION_APPLICATION_STATUSES])
  } else if (filter === "approved") {
    query = query.eq("status", "approved")
  } else if (filter === "approved_pending_registration") {
    query = query.eq("status", "approved").is("enrollment_id", null)
  } else if (filter === "waitlisted") {
    query = query.eq("status", "waitlisted")
  } else if (filter === "declined") {
    query = query.in("status", ["not_approved", "declined"])
  }

  const { data, error } = await query

  if (error) {
    console.error("getDepartmentApplications:", error.message)
    return []
  }

  const userIds = [
    ...new Set(
      (data || [])
        .flatMap((row) => [
          row.updated_by_user_id as string | null,
          row.evaluated_by_user_id as string | null,
        ])
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const nameByUserId = await resolveUserDisplayNames(userIds)

  return (data || []).map((row) => {
    const base = mapApplication(row as Record<string, unknown>)
    const offering = row.offering as { name?: string } | null
    const approved = row.approved_offering as { name?: string } | null
    return {
      ...base,
      program_name: programNameById.get(base.program_id),
      offering_name: offering?.name,
      approved_offering_name: approved?.name ?? null,
      updated_by_name: base.updated_by_user_id
        ? nameByUserId.get(base.updated_by_user_id) || null
        : null,
      evaluated_by_name: base.evaluated_by_user_id
        ? nameByUserId.get(base.evaluated_by_user_id) || null
        : null,
    }
  })
}

/** @deprecated Prefer getDepartmentApplications(..., "submitted") */
export async function getSubmittedApplicationsForDepartment(
  departmentId: string
): Promise<ProgramApplicationWithDetails[]> {
  return getDepartmentApplications(departmentId, "submitted")
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

  if (
    (existing.status as string) !== "submitted" &&
    !EVALUATION_APPLICATION_STATUSES.includes(
      existing.status as (typeof EVALUATION_APPLICATION_STATUSES)[number]
    )
  ) {
    return {
      success: false,
      error: "Only applications in review or evaluation can be approved or declined.",
    }
  }

  const { data: programForAccess } = await supabase
    .from("programs")
    .select("department_id")
    .eq("id", existing.program_id as string)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const departmentId = (programForAccess?.department_id as string | null) || null
  if (departmentId) {
    if (!(await canManageDepartment(departmentId))) {
      return {
        success: false,
        error: "You do not have permission to evaluate applications for this department.",
      }
    }
  } else if (!(await hasPermission(PERMISSIONS.PROGRAMS_MANAGE))) {
    return {
      success: false,
      error: "You do not have permission to evaluate applications.",
    }
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
  const evaluationNotes =
    input.notes !== undefined
      ? input.notes?.trim() || null
      : ((existing.evaluation_notes as string | null) ?? null)

  const { data, error } = await supabase
    .from("program_applications")
    .update({
      status: input.decision,
      approved_offering_id: approvedOfferingId,
      evaluation_notes: evaluationNotes,
      evaluated_at: now,
      evaluated_by_user_id: input.evaluatedByUserId,
      updated_by_user_id: input.evaluatedByUserId,
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

export type ApplicationWorkflowStatus =
  | "evaluation_required"
  | "evaluation_scheduled"
  | "evaluation_completed"
  | "waitlisted"
  | "withdrawn"

export async function setProgramApplicationWorkflowStatus(input: {
  applicationId: string
  status: ApplicationWorkflowStatus
}): Promise<
  | { success: true; application: ProgramApplication }
  | { success: false; error: string }
> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { success: false, error: "You must be signed in." }
  }

  const { data: existing, error: loadError } = await supabase
    .from("program_applications")
    .select("*")
    .eq("id", input.applicationId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadError || !existing) {
    return { success: false, error: "Application not found." }
  }

  const { data: programForAccess } = await supabase
    .from("programs")
    .select("department_id")
    .eq("id", existing.program_id as string)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const departmentId = (programForAccess?.department_id as string | null) || null
  if (departmentId) {
    if (!(await canManageDepartment(departmentId))) {
      return {
        success: false,
        error: "You do not have permission to update this application.",
      }
    }
  } else if (!(await hasPermission(PERMISSIONS.PROGRAMS_MANAGE))) {
    return {
      success: false,
      error: "You do not have permission to update this application.",
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("program_applications")
    .update({
      status: input.status,
      updated_by_user_id: user.id,
      updated_at: now,
    })
    .eq("id", input.applicationId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error || !data) {
    return {
      success: false,
      error: error?.message || "Failed to update application.",
    }
  }

  if (departmentId) {
    revalidatePath(workforceDepartmentDetailPath(departmentId))
  }
  revalidatePath(`/programs/${existing.program_id as string}`)
  return { success: true, application: mapApplication(data) }
}

/**
 * Move an approved (not yet registered) application back to submitted for re-review.
 */
export async function unapproveProgramApplication(input: {
  applicationId: string
}): Promise<
  | { success: true; application: ProgramApplication }
  | { success: false; error: string }
> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: existing, error: loadError } = await supabase
    .from("program_applications")
    .select("*")
    .eq("id", input.applicationId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadError || !existing) {
    return { success: false, error: "Application not found." }
  }

  if ((existing.status as string) !== "approved") {
    return {
      success: false,
      error: "Only approved applications can be un-approved.",
    }
  }
  if (existing.enrollment_id != null) {
    return {
      success: false,
      error: "This applicant already registered. Un-approve is not available.",
    }
  }

  const { data: programForAccess } = await supabase
    .from("programs")
    .select("department_id")
    .eq("id", existing.program_id as string)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const departmentId = (programForAccess?.department_id as string | null) || null
  if (departmentId) {
    if (!(await canManageDepartment(departmentId))) {
      return {
        success: false,
        error:
          "You do not have permission to un-approve applications for this department.",
      }
    }
  } else if (!(await hasPermission(PERMISSIONS.PROGRAMS_MANAGE))) {
    return {
      success: false,
      error: "You do not have permission to un-approve applications.",
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("program_applications")
    .update({
      status: "submitted",
      approved_offering_id: null,
      evaluated_at: null,
      evaluated_by_user_id: null,
      updated_by_user_id: user?.id || null,
      updated_at: now,
    })
    .eq("id", input.applicationId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error || !data) {
    console.error("unapproveProgramApplication:", error?.message)
    return {
      success: false,
      error: error?.message || "Failed to un-approve application.",
    }
  }

  if (departmentId) {
    revalidatePath(workforceDepartmentDetailPath(departmentId))
  }
  revalidatePath(`/programs/${existing.program_id as string}`)
  revalidatePath(`/customer/programs/${existing.program_id as string}`)
  revalidatePath(`/customer/programs/${existing.program_id as string}/apply`)

  return { success: true, application: mapApplication(data) }
}

export type EvaluateProgramApplicationsBatchInput = {
  applicationIds: string[]
  decision: "approved" | "not_approved"
  notes?: string | null
  evaluatedByUserId: string
}

export async function evaluateProgramApplicationsBatch(
  input: EvaluateProgramApplicationsBatchInput
): Promise<
  | { success: true; approved: number; failed: number; errors: string[] }
  | { success: false; error: string }
> {
  const ids = [
    ...new Set(
      (input.applicationIds || []).map((id) => String(id || "").trim()).filter(Boolean)
    ),
  ]
  if (ids.length === 0) {
    return { success: false, error: "Select at least one application." }
  }
  if (!input.evaluatedByUserId) {
    return { success: false, error: "You must be signed in to evaluate applications." }
  }

  let approved = 0
  let failed = 0
  const errors: string[] = []

  for (const applicationId of ids) {
    const result = await evaluateProgramApplication({
      applicationId,
      decision: input.decision,
      notes: input.notes,
      evaluatedByUserId: input.evaluatedByUserId,
    })
    if (result.success) {
      approved += 1
    } else {
      failed += 1
      errors.push(result.error)
    }
  }

  return { success: true, approved, failed, errors }
}

export async function fetchDepartmentApplicationsAction(
  departmentId: string,
  filter: DepartmentApplicationListFilter = "all",
  programId?: string | null
) {
  try {
    const rows = await getDepartmentApplications(departmentId, filter, {
      programId,
    })
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

export async function fetchDepartmentApplicationStageCountsAction(
  departmentId: string
) {
  try {
    const [submitted, approvedPending] = await Promise.all([
      getDepartmentApplications(departmentId, "submitted"),
      getDepartmentApplications(departmentId, "approved_pending_registration"),
    ])
    return {
      success: true as const,
      needsReview: submitted.length,
      approvedPending: approvedPending.length,
    }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load application counts.",
      needsReview: 0,
      approvedPending: 0,
    }
  }
}

export type UpdateProgramApplicationDetailsInput = {
  applicationId: string
  participantName: string
  applicantType: ProgramApplicantType
  /** Primary course (also first of offeringIds when multi-select). */
  offeringId: string
  /** All selected courses; stored in application_answers.requested_offering_ids. */
  offeringIds?: string[]
  answers: ProgramApplicationAnswers
}

/**
 * Staff update of application form fields while pending review or approved
 * but not yet registered.
 */
export async function updateProgramApplicationDetails(
  input: UpdateProgramApplicationDetailsInput
): Promise<
  | { success: true; application: ProgramApplication }
  | { success: false; error: string }
> {
  const name = input.participantName.trim()
  if (!name) {
    return { success: false, error: "Full name is required." }
  }

  const offeringIds = [
    ...new Set(
      (input.offeringIds?.length
        ? input.offeringIds
        : input.offeringId
          ? [input.offeringId]
          : []
      )
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ]
  const primaryOfferingId = offeringIds[0] || ""
  if (!primaryOfferingId) {
    return { success: false, error: "Select at least one course." }
  }

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

  const status = existing.status as string
  const canEditSubmitted = status === "submitted"
  const canEditApprovedPending =
    status === "approved" && existing.enrollment_id == null
  if (!canEditSubmitted && !canEditApprovedPending) {
    return {
      success: false,
      error:
        "Only pending or approved (not yet registered) applications can be edited.",
    }
  }

  const { data: programForAccess } = await supabase
    .from("programs")
    .select("department_id")
    .eq("id", existing.program_id as string)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const departmentId = (programForAccess?.department_id as string | null) || null
  if (departmentId) {
    if (!(await canManageDepartment(departmentId))) {
      return {
        success: false,
        error:
          "You do not have permission to edit applications for this department.",
      }
    }
  } else if (!(await hasPermission(PERMISSIONS.PROGRAMS_MANAGE))) {
    return {
      success: false,
      error: "You do not have permission to edit applications.",
    }
  }

  const { data: offeringRows } = await supabase
    .from("program_offerings")
    .select("id, program_id")
    .in("id", offeringIds)
    .eq("organization_id", organizationId)

  if (!offeringRows || offeringRows.length !== offeringIds.length) {
    return { success: false, error: "One or more courses were not found." }
  }
  for (const offering of offeringRows) {
    if ((offering.program_id as string) !== (existing.program_id as string)) {
      return {
        success: false,
        error: "Courses must belong to the same program.",
      }
    }
  }

  const now = new Date().toISOString()
  const applicationAnswers = sanitizeAnswersForStorage(
    {
      ...input.answers,
      requested_offering_ids: offeringIds,
    },
    input.applicantType
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const updatePayload: Record<string, unknown> = {
    participant_name: name,
    applicant_type: input.applicantType,
    offering_id: primaryOfferingId,
    application_answers: applicationAnswers,
    updated_by_user_id: user?.id || null,
    updated_at: now,
  }
  if (canEditApprovedPending) {
    updatePayload.approved_offering_id = primaryOfferingId
  }

  const { data, error } = await supabase
    .from("program_applications")
    .update(updatePayload)
    .eq("id", input.applicationId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error || !data) {
    console.error("updateProgramApplicationDetails:", error?.message)
    return {
      success: false,
      error: error?.message || "Failed to save application.",
    }
  }

  if (departmentId) {
    revalidatePath(workforceDepartmentDetailPath(departmentId))
  }
  revalidatePath(`/programs/${existing.program_id as string}`)
  revalidatePath(`/customer/programs/${existing.program_id as string}`)
  revalidatePath(`/customer/programs/${existing.program_id as string}/apply`)

  return { success: true, application: mapApplication(data) }
}

export async function fetchProgramApplicationOfferingsAction(programId: string) {
  try {
    const offerings = await getOfferingsForProgram(programId)
    return {
      success: true as const,
      offerings: offerings
        .filter((row) => row.status !== "archived")
        .map((row) => ({ id: row.id, name: row.name })),
    }
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Failed to load courses.",
      offerings: [] as Array<{ id: string; name: string }>,
    }
  }
}
