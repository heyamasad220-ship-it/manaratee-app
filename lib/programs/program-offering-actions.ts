"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  attributesFromProgramRow,
  mergeOfferingAttributes,
} from "@/lib/programs/program-offering-attributes"
import type {
  ProgramOfferingInput,
  ProgramOfferingType,
} from "@/lib/programs/program-offering-types"
import { syncRegistrationOptionsFromProgramFlags } from "@/lib/programs/program-registration-option-actions"

const PROGRAM_ATTRIBUTE_SELECT =
  "id, organization_id, start_date, end_date, enrollment_open_date, enrollment_close_date, status, full_program_registration_enabled, session_registration_enabled, program_type, min_age, max_age, min_grade, max_grade, grade_levels, gender, require_guardian, require_grade, require_emergency_contact, capacity, enable_waitlist, waitlist_capacity, waitlist_offer_deadline_days"

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

  const { error } = await supabase
    .from("program_offerings")
    .update({
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      enrollment_open_date: input.enrollmentOpenDate ?? null,
      enrollment_close_date: input.enrollmentCloseDate ?? null,
      status: offeringStatus,
      updated_at: new Date().toISOString(),
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
    fullProgramEnabled: program.full_program_registration_enabled ?? true,
    sessionRegistrationEnabled: program.session_registration_enabled ?? false,
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

  const { data, error } = await supabase
    .from("program_offerings")
    .update({
      name,
      offering_type: input.offering_type ?? "standard",
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      enrollment_open_date: input.enrollment_open_date ?? null,
      enrollment_close_date: input.enrollment_close_date ?? null,
      status: input.status ?? "draft",
      updated_at: new Date().toISOString(),
    })
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
    throw new Error("The default offering cannot be archived. Rename it instead.")
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

  if (offering.is_default) {
    throw new Error(
      "The default offering cannot be deleted. Rename it or archive it instead."
    )
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
      "This offering has registrations and cannot be deleted. Set status to Archived instead."
    )
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
