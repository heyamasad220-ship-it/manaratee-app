"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  getStaffAssignmentsForContact,
  getStaffAssignmentsForOffering,
  searchStaffEligibleContacts,
} from "@/lib/programs/program-staff-assignment-queries"
import type { ProgramStaffAssignmentRole } from "@/lib/programs/program-staff-assignment-types"

function revalidateStaffAssignmentPaths(programId: string, contactId?: string) {
  revalidatePath(`/programs/${programId}/edit`)
  revalidatePath("/my-classes")
  if (contactId) {
    revalidatePath(`/contacts/${contactId}`)
  }
}

async function assertStaffEligibleContact(
  organizationId: string,
  contactId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("contact_roles")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .in("role", ["employee", "volunteer"])

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.length) {
    throw new Error(
      "Selected contact must have an Employee or Volunteer role in People Management."
    )
  }
}

async function assertOfferingBelongsToProgram(input: {
  organizationId: string
  programId: string
  offeringId: string
}) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_offerings")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("id", input.offeringId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Invalid offering for this program.")
  }
}

async function assertSessionBelongsToOffering(input: {
  organizationId: string
  programId: string
  offeringId: string
  sessionId: string
}) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_sessions")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("program_id", input.programId)
    .eq("offering_id", input.offeringId)
    .eq("id", input.sessionId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Invalid session for this offering.")
  }
}

async function deactivateOfferingPrimaryInstructor(input: {
  organizationId: string
  offeringId: string
  sessionId: string | null
  excludeId?: string
}) {
  if (input.sessionId) {
    return
  }

  const supabase = await createClient()

  let query = supabase
    .from("program_staff_assignments")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("offering_id", input.offeringId)
    .eq("assignment_role", "primary_instructor")
    .is("session_id", null)
    .eq("is_active", true)

  if (input.excludeId) {
    query = query.neq("id", input.excludeId)
  }

  const { error } = await query

  if (error) {
    throw new Error(error.message)
  }
}

export async function createProgramStaffAssignment(input: {
  programId: string
  offeringId: string
  contactId: string
  assignmentRole: ProgramStaffAssignmentRole
  sessionId?: string | null
  startDate?: string | null
  endDate?: string | null
  notes?: string | null
}) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  await assertStaffEligibleContact(organizationId, input.contactId)
  await assertOfferingBelongsToProgram({
    organizationId,
    programId: input.programId,
    offeringId: input.offeringId,
  })

  const sessionId = input.sessionId ?? null

  if (sessionId) {
    await assertSessionBelongsToOffering({
      organizationId,
      programId: input.programId,
      offeringId: input.offeringId,
      sessionId,
    })
  }

  if (input.assignmentRole === "primary_instructor" && !sessionId) {
    await deactivateOfferingPrimaryInstructor({
      organizationId,
      offeringId: input.offeringId,
      sessionId: null,
    })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_staff_assignments")
    .insert({
      organization_id: organizationId,
      contact_id: input.contactId,
      program_id: input.programId,
      offering_id: input.offeringId,
      session_id: sessionId,
      assignment_role: input.assignmentRole,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      notes: input.notes?.trim() || null,
      is_active: true,
    })
    .select("id, contact_id")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new Error("This person already has that assignment for this offering.")
    }
    throw new Error(error.message)
  }

  revalidateStaffAssignmentPaths(input.programId, data.contact_id as string)

  return getStaffAssignmentsForOffering(input.offeringId, organizationId)
}

export async function removeProgramStaffAssignment(input: {
  programId: string
  assignmentId: string
}) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const supabase = await createClient()

  const { data: existing, error: loadError } = await supabase
    .from("program_staff_assignments")
    .select("id, contact_id, offering_id")
    .eq("organization_id", organizationId)
    .eq("id", input.assignmentId)
    .maybeSingle()

  if (loadError || !existing) {
    throw new Error("Assignment not found.")
  }

  const { error } = await supabase
    .from("program_staff_assignments")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", input.assignmentId)

  if (error) {
    throw new Error(error.message)
  }

  revalidateStaffAssignmentPaths(
    input.programId,
    existing.contact_id as string
  )

  return getStaffAssignmentsForOffering(existing.offering_id as string, organizationId)
}

export async function searchProgramStaffContactsAction(search?: string) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  return searchStaffEligibleContacts(organizationId, search)
}

export async function loadContactProgramAssignments(contactId: string) {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  return getStaffAssignmentsForContact(contactId, organizationId)
}
