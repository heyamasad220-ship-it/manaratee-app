"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  attributesFromProgramRow,
  mergeOfferingAttributes,
} from "@/lib/programs/program-offering-attributes"
import { DEFAULT_NEW_OFFERING_INHERIT_FLAGS } from "@/lib/programs/program-offering-inherit"
import type {
  ProgramOfferingInput,
  ProgramOfferingType,
} from "@/lib/programs/program-offering-types"
import { syncRegistrationOptionsFromProgramFlags } from "@/lib/programs/program-registration-option-actions"

const PROGRAM_ATTRIBUTE_SELECT =
  "id, organization_id, start_date, end_date, enrollment_open_date, enrollment_close_date, status, full_program_registration_enabled, session_registration_enabled, single_session_registration_enabled, program_type, min_age, max_age, min_grade, max_grade, grade_levels, gender, require_guardian, require_grade, require_emergency_contact, capacity, enable_waitlist, waitlist_capacity, waitlist_offer_deadline_days"

type CreateDefaultOfferingInput = {
  organizationId: string
  programId: string
  programName: string
  startDate?: string | null
  endDate?: string | null
  enrollmentOpenDate?: string | null
  enrollmentCloseDate?: string | null
  programStatus?: string | null
}

export async function createDefaultOffering(input: CreateDefaultOfferingInput) {
  const supabase = await createClient()

  const offeringStatus =
    input.programStatus === "draft" ? "draft" : "active"

  const { data: program } = await supabase
    .from("programs")
    .select(PROGRAM_ATTRIBUTE_SELECT)
    .eq("id", input.programId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  const attributes = attributesFromProgramRow(program || {})

  const { data, error } = await supabase
    .from("program_offerings")
    .insert({
      organization_id: input.organizationId,
      program_id: input.programId,
      name: `${input.programName} — Default Offering`,
      is_default: true,
      offering_type: "standard" satisfies ProgramOfferingType,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      enrollment_open_date: input.enrollmentOpenDate ?? null,
      enrollment_close_date: input.enrollmentCloseDate ?? null,
      status: offeringStatus,
      ...DEFAULT_NEW_OFFERING_INHERIT_FLAGS,
      ...attributes,
    })
    .select("id")
    .single()

  if (error) {
    console.error("createDefaultOffering:", error)
    throw new Error("Failed to create default program offering")
  }

  return data.id as string
}

export async function syncDefaultOfferingDates(input: {
  organizationId: string
  programId: string
  startDate?: string | null
  endDate?: string | null
  enrollmentOpenDate?: string | null
  enrollmentCloseDate?: string | null
  programStatus?: string | null
}) {
  const supabase = await createClient()

  const offeringStatus =
    input.programStatus === "draft" ? "draft" : "active"

  // Snapshot dates onto offerings that inherit dates (F1). Default offering
  // still syncs when it is the only/legacy path and inherit may be false.
  const datePatch = {
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    enrollment_open_date: input.enrollmentOpenDate ?? null,
    enrollment_close_date: input.enrollmentCloseDate ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error: inheritError } = await supabase
    .from("program_offerings")
    .update(datePatch)
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("inherit_dates", true)

  if (inheritError) {
    console.error("syncDefaultOfferingDates inherit:", inheritError)
    throw new Error("Failed to sync inheriting offering dates")
  }

  const { error } = await supabase
    .from("program_offerings")
    .update({
      ...datePatch,
      status: offeringStatus,
    })
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("is_default", true)

  if (error) {
    console.error("syncDefaultOfferingDates:", error)
    throw new Error("Failed to sync default offering")
  }
}

export async function ensureDefaultOffering(input: CreateDefaultOfferingInput) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("program_offerings")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("is_default", true)
    .maybeSingle()

  if (existing?.id) {
    await syncDefaultOfferingDates(input)
    return existing.id as string
  }

  return createDefaultOffering(input)
}

async function resolveOrganizationId(explicitOrganizationId?: string) {
  const organizationId =
    explicitOrganizationId || (await getSelectedOrganizationId())

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  return organizationId
}

async function getProgramForOfferingActions(
  programId: string,
  organizationId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("programs")
    .select(PROGRAM_ATTRIBUTE_SELECT)
    .eq("id", programId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    console.error("getProgramForOfferingActions:", error)
    throw new Error(error.message || "Failed to load program")
  }

  if (!data) {
    throw new Error(
      "Program not found for your organization. Refresh the page and try again."
    )
  }

  return data
}

function revalidateProgramPaths(programId: string) {
  revalidatePath("/programs/catalog")
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath(`/customer/programs/${programId}`)
  revalidatePath(`/customer/programs/${programId}/register`)
}

export async function createProgramOffering(
  programId: string,
  input: ProgramOfferingInput,
  organizationId?: string
) {
  const supabase = await createClient()
  const resolvedOrganizationId = await resolveOrganizationId(organizationId)

  const name = input.name.trim()
  if (!name) {
    throw new Error("Offering name is required")
  }

  const program = await getProgramForOfferingActions(
    programId,
    resolvedOrganizationId
  )

  const offeringStatus =
    input.status ??
    (program.status === "draft" ? "draft" : "active")

  const attributes = mergeOfferingAttributes(
    attributesFromProgramRow(program),
    input.attributes
  )

  const { count: existingCount } = await supabase
    .from("program_offerings")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", resolvedOrganizationId)
    .eq("program_id", programId)
    .neq("status", "archived")

  const isDefault = (existingCount ?? 0) === 0

  const { data, error } = await supabase
    .from("program_offerings")
    .insert({
      organization_id: program.organization_id,
      program_id: programId,
      name,
      is_default: isDefault,
      offering_type: input.offering_type ?? "standard",
      start_date: input.start_date ?? program.start_date,
      end_date: input.end_date ?? program.end_date,
      enrollment_open_date:
        input.enrollment_open_date ?? program.enrollment_open_date,
      enrollment_close_date:
        input.enrollment_close_date ?? program.enrollment_close_date,
      status: offeringStatus,
      inherit_dates:
        input.inherit_dates ?? DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_dates,
      inherit_eligibility:
        input.inherit_eligibility ??
        DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_eligibility,
      inherit_enrollment:
        input.inherit_enrollment ??
        DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_enrollment,
      ...attributes,
    })
    .select("*")
    .single()

  if (error) {
    console.error("createProgramOffering insert:", error)
    throw new Error(error.message)
  }

  await syncRegistrationOptionsFromProgramFlags({
    organizationId: program.organization_id as string,
    programId,
    offeringId: data.id as string,
    fullProgramEnabled:
      attributes.registration_mode === "none"
        ? false
        : (program.full_program_registration_enabled ?? true),
    sessionRegistrationEnabled:
      attributes.registration_mode === "none"
        ? false
        : (program.session_registration_enabled ?? false),
    singleSessionEnabled: false,
    dropInEnabled: false,
  })

  revalidateProgramPaths(programId)

  return data
}

export async function updateProgramOffering(
  offeringId: string,
  input: ProgramOfferingInput
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Offering name is required")
  }

  const updatePayload: Record<string, unknown> = {
    name,
    offering_type: input.offering_type ?? "standard",
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    enrollment_open_date: input.enrollment_open_date ?? null,
    enrollment_close_date: input.enrollment_close_date ?? null,
    status: input.status ?? "draft",
    updated_at: new Date().toISOString(),
  }

  if (input.flyer_url !== undefined) {
    updatePayload.flyer_url = input.flyer_url?.trim() || null
  }
  if (input.background_color !== undefined) {
    updatePayload.background_color = input.background_color?.trim() || null
  }
  if (input.attributes?.delivery_format) {
    updatePayload.delivery_format = input.attributes.delivery_format
  }
  if (input.attributes?.attendance_tracked !== undefined) {
    updatePayload.attendance_tracked = input.attributes.attendance_tracked
  }
  if (input.attributes?.care_enabled !== undefined) {
    updatePayload.care_enabled = input.attributes.care_enabled
  }

  const { data, error } = await supabase
    .from("program_offerings")
    .update(updatePayload)
    .eq("id", offeringId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidateProgramPaths(data.program_id as string)

  return data
}

export async function archiveProgramOffering(offeringId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: offering, error: fetchError } = await supabase
    .from("program_offerings")
    .select("id, program_id, is_default")
    .eq("id", offeringId)
    .eq("organization_id", organizationId)
    .single()

  if (fetchError || !offering) {
    throw new Error("Offering not found")
  }

  if (offering.is_default) {
    const { error: clearDefaultError } = await supabase
      .from("program_offerings")
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offeringId)
      .eq("organization_id", organizationId)

    if (clearDefaultError) {
      throw new Error(clearDefaultError.message)
    }
  }

  const { error } = await supabase
    .from("program_offerings")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", offeringId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidateProgramPaths(offering.program_id as string)
}

export async function deleteProgramOffering(offeringId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: offering, error: fetchError } = await supabase
    .from("program_offerings")
    .select("id, program_id, is_default, name")
    .eq("id", offeringId)
    .eq("organization_id", organizationId)
    .single()

  if (fetchError || !offering) {
    throw new Error("Offering not found")
  }

  const { count, error: enrollmentError } = await supabase
    .from("program_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)

  if (enrollmentError) {
    console.error("deleteProgramOffering enrollment check:", enrollmentError)
    throw new Error("Could not verify registrations for this offering")
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      "This program has registrations and cannot be deleted. Archive it instead."
    )
  }

  // Empty default shells (e.g. auto-created year defaults) can be removed after
  // clearing is_default so the unique default constraint is satisfied.
  if (offering.is_default) {
    const { error: clearDefaultError } = await supabase
      .from("program_offerings")
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offeringId)
      .eq("organization_id", organizationId)

    if (clearDefaultError) {
      console.error("deleteProgramOffering clear default:", clearDefaultError)
      throw new Error(clearDefaultError.message)
    }
  }

  const { error: deleteError } = await supabase
    .from("program_offerings")
    .delete()
    .eq("id", offeringId)
    .eq("organization_id", organizationId)

  if (deleteError) {
    console.error("deleteProgramOffering:", deleteError)
    throw new Error(deleteError.message)
  }

  revalidateProgramPaths(offering.program_id as string)
}

/**
 * F2: Snapshot program defaults onto offerings that still inherit each group.
 * Also refreshes registration options when inherit_enrollment is true.
 */
export async function syncInheritingOfferingsFromProgram(input: {
  organizationId: string
  programId: string
}) {
  const supabase = await createClient()

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select(PROGRAM_ATTRIBUTE_SELECT)
    .eq("id", input.programId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (programError || !program) {
    console.error("syncInheritingOfferingsFromProgram program:", programError)
    throw new Error("Failed to load program for inherit sync")
  }

  const attributes = attributesFromProgramRow(program)
  const now = new Date().toISOString()

  const { error: datesError } = await supabase
    .from("program_offerings")
    .update({
      start_date: program.start_date ?? null,
      end_date: program.end_date ?? null,
      enrollment_open_date: program.enrollment_open_date ?? null,
      enrollment_close_date: program.enrollment_close_date ?? null,
      updated_at: now,
    })
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("inherit_dates", true)
    .neq("status", "archived")

  if (datesError) {
    console.error("syncInheritingOfferingsFromProgram dates:", datesError)
    throw new Error("Failed to sync inheriting offering dates")
  }

  const { error: eligibilityError } = await supabase
    .from("program_offerings")
    .update({
      audience_type: attributes.audience_type,
      min_age: attributes.min_age,
      max_age: attributes.max_age,
      min_grade: attributes.min_grade,
      max_grade: attributes.max_grade,
      grade_levels: attributes.grade_levels,
      gender: attributes.gender,
      require_guardian: attributes.require_guardian,
      require_grade: attributes.require_grade,
      require_emergency_contact: attributes.require_emergency_contact,
      updated_at: now,
    })
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("inherit_eligibility", true)
    .neq("status", "archived")

  if (eligibilityError) {
    console.error(
      "syncInheritingOfferingsFromProgram eligibility:",
      eligibilityError
    )
    throw new Error("Failed to sync inheriting offering eligibility")
  }

  const { error: enrollmentError } = await supabase
    .from("program_offerings")
    .update({
      enable_waitlist: attributes.enable_waitlist,
      waitlist_capacity: attributes.waitlist_capacity,
      waitlist_offer_deadline_days: attributes.waitlist_offer_deadline_days,
      registration_mode: attributes.registration_mode,
      updated_at: now,
    })
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("inherit_enrollment", true)
    .neq("status", "archived")

  if (enrollmentError) {
    console.error(
      "syncInheritingOfferingsFromProgram enrollment:",
      enrollmentError
    )
    throw new Error("Failed to sync inheriting offering enrollment")
  }

  const { data: inheritingEnrollment, error: listError } = await supabase
    .from("program_offerings")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("inherit_enrollment", true)
    .neq("status", "archived")

  if (listError) {
    console.error("syncInheritingOfferingsFromProgram list:", listError)
    throw new Error("Failed to list inheriting offerings")
  }

  const fullProgramEnabled = Boolean(
    program.full_program_registration_enabled ?? true
  )
  const sessionRegistrationEnabled = Boolean(
    program.session_registration_enabled
  )
  const singleSessionEnabled = Boolean(
    (program as { single_session_registration_enabled?: boolean })
      .single_session_registration_enabled
  )

  for (const row of inheritingEnrollment || []) {
    await syncRegistrationOptionsFromProgramFlags({
      organizationId: input.organizationId,
      programId: input.programId,
      offeringId: row.id as string,
      fullProgramEnabled,
      sessionRegistrationEnabled,
      singleSessionEnabled,
      dropInEnabled: false,
    })
  }

  revalidateProgramPaths(input.programId)
}
