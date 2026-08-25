"use server"

import { revalidatePath } from "next/cache"

import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { syncRegistrationOptionsFromProgramFlags } from "@/lib/programs/program-registration-option-actions"

import { getAgeGroupLabelsFromMinMax } from "@/lib/programs/program-eligibility-display"
import { normalizeProgramAudienceType } from "@/lib/programs/program-offering-attributes"
import {
  getTodayDateString,
  shouldCloseEnrollmentForStatus,
} from "@/lib/programs/program-enrollment-availability"
import {
  normalizeProgramKind,
  type ProgramKind,
} from "@/lib/programs/program-kind"

function isMissingProgramColumnError(error: { message?: string; code?: string }) {
  const message = (error.message || "").toLowerCase()

  return (
    error.code === "PGRST204" ||
    message.includes("schema cache") ||
    (message.includes("could not find") && message.includes("column"))
  )
}

function omitUnavailableProgramColumns<T extends Record<string, unknown>>(
  payload: T,
  error: { message?: string }
): T {
  const message = (error.message || "").toLowerCase()
  const next = { ...payload }

  if (message.includes("min_age") || message.includes("max_age")) {
    delete next.min_age
    delete next.max_age
  }
  if (message.includes("single_session_registration_enabled")) {
    delete next.single_session_registration_enabled
  }
  if (message.includes("drop_in_registration_enabled")) {
    delete next.drop_in_registration_enabled
  }

  if (message.includes("enrollment_process")) {
    delete next.enrollment_process
  }
  if (message.includes("evaluation_required")) {
    delete next.evaluation_required
  }
  if (message.includes("seat_activation_rule")) {
    delete next.seat_activation_rule
  }

  return next
}

type CreateProgramInput = {
  name: string
  subtitle?: string | null
  description?: string
  department_id?: string | null
  flyer_url?: string | null
  background_color?: string | null
  /** academic (QIL-style) or seasonal (camp). Default academic. */
  program_kind?: ProgramKind
  /** Delivery for seasonal leaf offering (default in_person). */
  delivery_format?: "in_person" | "online" | "hybrid"
  /**
   * When false, customers Register & pay with no Apply/Approve step.
   * Seasonal defaults to open enrollment; academic defaults to application required.
   */
  application_required?: boolean
  program_type?: "adult" | "youth"
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  grade_levels?: string[]
  min_grade?: string | null
  max_grade?: string | null
  gender?: string | null
  capacity?: number
  status?: string
  visibility?: "public" | "private" | "members_only"
  full_program_registration_enabled?: boolean
  session_registration_enabled?: boolean
  min_age?: number | null
  max_age?: number | null
  require_guardian?: boolean
  require_grade?: boolean
  require_emergency_contact?: boolean
}

/**
 * Create program identity + optional defaults.
 * Academic: no offering (add offerings later).
 * Seasonal: creates the single leaf offering (same name) so fees/sessions work;
 * staff manage it as the season — no offerings chrome.
 */
export async function createProgram(input: CreateProgramInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (
    input.min_age != null &&
    input.max_age != null &&
    input.min_age > input.max_age
  ) {
    throw new Error("Minimum age cannot be greater than maximum age.")
  }

  const status = input.status || "draft"
  const enrollmentCloseDate = shouldCloseEnrollmentForStatus(status)
    ? getTodayDateString()
    : input.enrollment_close_date || null

  const programType = normalizeProgramAudienceType(input.program_type)
  const programKind = normalizeProgramKind(input.program_kind)

  const { getOrganizationProgramKindsEntitlement } = await import(
    "@/lib/programs/organization-program-kinds"
  )
  const {
    organizationAllowsProgramKind,
    assertRegistrationFlagsAllowedForKind,
  } = await import("@/lib/programs/program-kind-policy")

  const entitlement = await getOrganizationProgramKindsEntitlement()
  if (!organizationAllowsProgramKind(entitlement, programKind)) {
    throw new Error(
      entitlement === "academic"
        ? "This organization is subscribed to Academic Programs only."
        : entitlement === "seasonal"
          ? "This organization is subscribed to Seasonal Programs only."
          : "This program type is not enabled for your organization."
    )
  }

  const registrationCheck = assertRegistrationFlagsAllowedForKind({
    programKind,
    session_registration_enabled: input.session_registration_enabled,
  })
  if (!registrationCheck.ok) {
    throw new Error(registrationCheck.error)
  }

  const sessionRegistrationEnabled =
    programKind === "academic"
      ? false
      : (input.session_registration_enabled ?? false)

  const insertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      name: input.name,
      subtitle: input.subtitle || null,
      description: input.description || null,
      department_id: input.department_id || null,
      flyer_url: input.flyer_url || null,
      background_color: input.background_color || null,
      program_kind: programKind,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      enrollment_open_date: input.enrollment_open_date || null,
      enrollment_close_date: enrollmentCloseDate,

      // Optional defaults inherited by new offerings (not operational SSOT).
      program_type: programType,
      age_groups: getAgeGroupLabelsFromMinMax(input.min_age, input.max_age),
      grade_levels: input.grade_levels || [],
      min_grade: input.min_grade ?? null,
      max_grade: input.max_grade ?? null,
      gender: input.gender || "All",
      min_age: input.min_age ?? null,
      max_age: input.max_age ?? null,

      require_guardian:
        input.require_guardian ?? (programType === "adult" ? false : true),
      require_grade: input.require_grade ?? false,
      require_emergency_contact: input.require_emergency_contact ?? true,

      full_program_registration_enabled:
        input.full_program_registration_enabled ?? true,
      session_registration_enabled: sessionRegistrationEnabled,

      capacity: input.capacity || 0,
      enrolled: 0,
      waitlist: 0,
      status,
      visibility: input.visibility || "public",
      enrollment_process:
        programKind === "seasonal" || input.application_required === false
          ? "direct_registration"
          : "application_approval",
      evaluation_required: false,
      seat_activation_rule: "on_registration",
  }

  let { data, error } = await supabase
    .from("programs")
    .insert(insertPayload)
    .select("id")
    .single()

  if (error && isMissingProgramColumnError(error)) {
    const retryPayload = omitUnavailableProgramColumns(insertPayload, error)
    delete retryPayload.program_kind
    ;({ data, error } = await supabase
      .from("programs")
      .insert(retryPayload)
      .select("id")
      .single())
  }

  if (error || !data) {
    console.error(error)
    throw new Error("Failed to create program")
  }

  const programId = data.id as string

  let offeringId: string | null = null
  if (programKind === "seasonal") {
    const { createProgramOffering } = await import(
      "@/lib/programs/program-offering-actions"
    )
    const offering = await createProgramOffering(programId, {
      name: input.name.trim(),
      offering_type: "summer",
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      enrollment_open_date: input.enrollment_open_date || null,
      enrollment_close_date: enrollmentCloseDate,
      status: status === "draft" ? "draft" : "active",
      // Seasonal leaf is the operational SSOT — no inherit toggles in UI.
      inherit_dates: false,
      inherit_eligibility: false,
      inherit_enrollment: false,
      attributes: {
        delivery_format: input.delivery_format || "in_person",
        audience_type: programType,
        application_required:
          input.application_required ?? programKind !== "seasonal",
        gender: input.gender || "All",
        min_age: input.min_age ?? null,
        max_age: input.max_age ?? null,
        capacity_mode:
          input.capacity && input.capacity > 0 ? "limited" : "unlimited",
        capacity:
          input.capacity && input.capacity > 0 ? input.capacity : null,
      },
    })
    offeringId = offering.id
  }

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  if (input.department_id) {
    revalidatePath(workforceDepartmentDetailPath(input.department_id))
  }

  return { programId, offeringId, programKind }
}

type UpdateProgramInput = {
  id: string
  name: string
  subtitle?: string | null
  description?: string
  department_id?: string | null
  flyer_url?: string | null
  background_color?: string | null
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  age_groups?: string[]
  grade_levels?: string[]
  gender?: string | null
  /** @deprecated Catalog uses sum of offering capacities; ignored on write when omitOperationalFields. */
  capacity?: number
  status?: string

  full_program_registration_enabled?: boolean
  session_registration_enabled?: boolean
  single_session_registration_enabled?: boolean
  drop_in_registration_enabled?: boolean

  financial_assistance_enabled?: boolean
  financial_assistance_open?: boolean
  financial_assistance_close_date?: string | null
  financial_assistance_instructions?: string | null

  program_type?: "adult" | "youth"
  min_age?: number | null
  max_age?: number | null
  min_grade?: string | null
  max_grade?: string | null
  require_guardian?: boolean
  require_grade?: boolean
  require_emergency_contact?: boolean

  enable_waitlist?: boolean
  waitlist_capacity?: number | null
  enrollment_process?: "direct_registration" | "application_approval"
  evaluation_required?: boolean
  seat_activation_rule?: "on_registration" | "after_initial_payment"

  /** @deprecated Fee plans live on offerings — not written (S4). */
  billing_type?:
    | "free"
    | "one_time"
    | "deposit_balance"
    | "monthly"
    | "installments"
  tuition_amount?: number
  deposit_amount?: number
  monthly_amount?: number
  installment_count?: number | null
  payment_due_day?: number | null

  visibility?: "public" | "private" | "members_only"

  /** Optional — updates academic vs seasonal classification. */
  program_kind?: ProgramKind

  /**
   * When true (default), only identity + optional defaults + FA are written.
   * Defaults include eligibility, dates, waitlist, and registration-type flags.
   * Capacity and legacy billing stay offering-scoped (not written here).
   */
  identityAndDefaultsOnly?: boolean
}

export async function updateProgram(input: UpdateProgramInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const minAge = input.min_age ?? null
  const maxAge = input.max_age ?? null

  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    throw new Error("Minimum age cannot be greater than maximum age.")
  }

  const ageGroups =
    input.age_groups?.length
      ? input.age_groups
      : getAgeGroupLabelsFromMinMax(minAge, maxAge)

  const status = input.status || "draft"
  let enrollmentOpenDate = input.enrollment_open_date || null
  let enrollmentCloseDate = input.enrollment_close_date || null

  if (shouldCloseEnrollmentForStatus(status)) {
    const today = getTodayDateString()
    if (!enrollmentCloseDate || enrollmentCloseDate > today) {
      enrollmentCloseDate = today
    }
  }

  const identityAndDefaultsOnly = input.identityAndDefaultsOnly !== false

  const programPayload: Record<string, unknown> = {
    name: input.name,
    subtitle: input.subtitle || null,
    description: input.description || null,
    department_id: input.department_id || null,
    flyer_url: input.flyer_url || null,
    background_color: input.background_color || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    enrollment_open_date: enrollmentOpenDate,
    enrollment_close_date: enrollmentCloseDate,
    status,
    visibility: input.visibility,

    // Optional defaults for new offerings
    age_groups: ageGroups,
    grade_levels: input.grade_levels || [],
    gender: input.gender || "All",
    min_age: minAge,
    max_age: maxAge,
    min_grade: input.min_grade ?? null,
    max_grade: input.max_grade ?? null,
    program_type: normalizeProgramAudienceType(input.program_type),
    require_guardian: input.require_guardian,
    require_grade: input.require_grade,
    require_emergency_contact: input.require_emergency_contact,

    financial_assistance_enabled:
      input.financial_assistance_enabled || false,
    financial_assistance_open: input.financial_assistance_open || false,
    financial_assistance_close_date:
      input.financial_assistance_close_date || null,
    financial_assistance_instructions:
      input.financial_assistance_instructions || null,

    // Program enrollment defaults (F2) — used when offerings inherit
    full_program_registration_enabled:
      input.full_program_registration_enabled ?? true,
    session_registration_enabled:
      input.session_registration_enabled ?? false,
    single_session_registration_enabled:
      input.single_session_registration_enabled ?? false,
    enable_waitlist: input.enable_waitlist ?? false,
    waitlist_capacity: input.waitlist_capacity ?? null,

    updated_at: new Date().toISOString(),
  }

  if (input.enrollment_process) {
    programPayload.enrollment_process = input.enrollment_process
    programPayload.evaluation_required =
      input.enrollment_process === "application_approval"
        ? Boolean(input.evaluation_required)
        : false
  }
  if (input.seat_activation_rule) {
    programPayload.seat_activation_rule = input.seat_activation_rule
  }

  if (input.program_kind) {
    const nextKind = normalizeProgramKind(input.program_kind)
    const { getOrganizationProgramKindsEntitlement } = await import(
      "@/lib/programs/organization-program-kinds"
    )
    const {
      organizationAllowsProgramKind,
      assertRegistrationFlagsAllowedForKind,
    } = await import("@/lib/programs/program-kind-policy")
    const entitlement = await getOrganizationProgramKindsEntitlement()
    if (!organizationAllowsProgramKind(entitlement, nextKind)) {
      throw new Error(
        entitlement === "academic"
          ? "This organization is subscribed to Academic Programs only."
          : entitlement === "seasonal"
            ? "This organization is subscribed to Seasonal Programs only."
            : "This program type is not enabled for your organization."
      )
    }
    const registrationCheck = assertRegistrationFlagsAllowedForKind({
      programKind: nextKind,
      session_registration_enabled: input.session_registration_enabled,
      single_session_registration_enabled:
        input.single_session_registration_enabled,
      drop_in_registration_enabled: input.drop_in_registration_enabled,
    })
    if (!registrationCheck.ok) {
      throw new Error(registrationCheck.error)
    }
    programPayload.program_kind = nextKind
    if (nextKind === "academic") {
      programPayload.session_registration_enabled = false
      programPayload.single_session_registration_enabled = false
    }
  } else {
    const { data: existingKindRow } = await supabase
      .from("programs")
      .select("program_kind")
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .maybeSingle()
    const existingKind = normalizeProgramKind(
      (existingKindRow as { program_kind?: string } | null)?.program_kind
    )
    const { assertRegistrationFlagsAllowedForKind } = await import(
      "@/lib/programs/program-kind-policy"
    )
    const registrationCheck = assertRegistrationFlagsAllowedForKind({
      programKind: existingKind,
      session_registration_enabled: input.session_registration_enabled,
      single_session_registration_enabled:
        input.single_session_registration_enabled,
      drop_in_registration_enabled: input.drop_in_registration_enabled,
    })
    if (!registrationCheck.ok) {
      throw new Error(registrationCheck.error)
    }
    if (existingKind === "academic") {
      programPayload.session_registration_enabled = false
      programPayload.single_session_registration_enabled = false
    }
  }

  if (!identityAndDefaultsOnly) {
    programPayload.capacity = input.capacity || 0
    programPayload.billing_type = input.billing_type
    programPayload.tuition_amount = input.tuition_amount
    programPayload.deposit_amount = input.deposit_amount
    programPayload.monthly_amount = input.monthly_amount
    programPayload.installment_count = input.installment_count
    programPayload.payment_due_day = input.payment_due_day
  }

  let payload: Record<string, unknown> = { ...programPayload }
  let { error } = await supabase
    .from("programs")
    .update(payload)
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  for (let attempt = 0; attempt < 3 && error && isMissingProgramColumnError(error); attempt++) {
    payload = omitUnavailableProgramColumns(payload, error)
    ;({ error } = await supabase
      .from("programs")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", organizationId))
  }

  if (error) {
    console.error("[updateProgram]", error)
    throw new Error(error.message || "Failed to update program")
  }

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath(`/programs/${input.id}`)
  revalidatePath(`/programs/${input.id}/offerings`)
  revalidatePath("/customer/programs")
  revalidatePath(`/customer/programs/${input.id}`)
  revalidatePath(`/customer/programs/${input.id}/register`)
  if (input.department_id) {
    revalidatePath(workforceDepartmentDetailPath(input.department_id))
  }
}

/** Updates only academic vs seasonal classification. */
export async function updateProgramKind(input: {
  id: string
  program_kind: ProgramKind
  department_id?: string | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const nextKind = normalizeProgramKind(input.program_kind)
  const { getOrganizationProgramKindsEntitlement } = await import(
    "@/lib/programs/organization-program-kinds"
  )
  const { organizationAllowsProgramKind } = await import(
    "@/lib/programs/program-kind-policy"
  )
  const entitlement = await getOrganizationProgramKindsEntitlement()
  if (!organizationAllowsProgramKind(entitlement, nextKind)) {
    throw new Error(
      entitlement === "academic"
        ? "This organization is subscribed to Academic Programs only."
        : entitlement === "seasonal"
          ? "This organization is subscribed to Seasonal Programs only."
          : "This program type is not enabled for your organization."
    )
  }

  const updatePayload: Record<string, unknown> = {
    program_kind: nextKind,
    updated_at: new Date().toISOString(),
  }
  if (nextKind === "academic") {
    updatePayload.session_registration_enabled = false
    updatePayload.single_session_registration_enabled = false
  }

  const { error } = await supabase
    .from("programs")
    .update(updatePayload)
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    if (isMissingProgramColumnError(error)) {
      throw new Error(
        "Program type column is missing. Run the program_kind migration."
      )
    }
    throw new Error(error.message || "Failed to update program type")
  }

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath(`/programs/${input.id}`)
  revalidatePath(`/programs/${input.id}/offerings`)
  if (input.department_id) {
    revalidatePath(workforceDepartmentDetailPath(input.department_id))
  }
}

/** @deprecated Prefer createProgramOffering; kept for duplicate/year helpers. */
export async function ensureProgramHasOfferingForLegacyCopy(input: {
  organizationId: string
  programId: string
  programName: string
  startDate?: string | null
  endDate?: string | null
  enrollmentOpenDate?: string | null
  enrollmentCloseDate?: string | null
  programStatus?: string | null
  fullProgramEnabled?: boolean
  sessionRegistrationEnabled?: boolean
}) {
  const { ensureDefaultOffering } = await import(
    "@/lib/programs/program-offering-actions"
  )
  const offeringId = await ensureDefaultOffering({
    organizationId: input.organizationId,
    programId: input.programId,
    programName: input.programName,
    startDate: input.startDate,
    endDate: input.endDate,
    enrollmentOpenDate: input.enrollmentOpenDate,
    enrollmentCloseDate: input.enrollmentCloseDate,
    programStatus: input.programStatus,
  })

  await syncRegistrationOptionsFromProgramFlags({
    organizationId: input.organizationId,
    programId: input.programId,
    offeringId,
    fullProgramEnabled: input.fullProgramEnabled ?? true,
    sessionRegistrationEnabled: input.sessionRegistrationEnabled ?? false,
  })

  return offeringId
}
