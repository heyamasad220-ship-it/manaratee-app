"use server"

import { revalidatePath } from "next/cache"

import {
  buildServiceRequirementsPayload,
  parseServiceRequirements,
  type EventServiceRequirementsFormState,
} from "@/lib/events/event-service-requirements"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { canManageProgram } from "@/lib/programs/program-access"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import { createClient } from "@/lib/supabase/server"

export async function updateProgramVolunteerSignups(input: {
  programId: string
  serviceForm: EventServiceRequirementsFormState
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!(await canManageProgram(input.programId))) {
    return { success: false, error: "You do not have permission to update this program." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  const { data: program, error: loadError } = await supabase
    .from("programs")
    .select("id, service_requirements")
    .eq("organization_id", organizationId)
    .eq("id", input.programId)
    .maybeSingle()

  if (loadError || !program) {
    return { success: false, error: loadError?.message || "Program not found." }
  }

  const payload = buildServiceRequirementsPayload(input.serviceForm)
  const existing = parseServiceRequirements(program.service_requirements)
  const serviceRequirements = {
    ...existing,
    ...(payload.service_requirements.volunteers
      ? { volunteers: payload.service_requirements.volunteers }
      : {}),
  }
  if (!payload.requires_volunteers) {
    delete serviceRequirements.volunteers
  }

  const { error } = await supabase
    .from("programs")
    .update({
      requires_volunteers: payload.requires_volunteers,
      service_requirements: serviceRequirements,
    })
    .eq("organization_id", organizationId)
    .eq("id", input.programId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(programWorkspaceHref(input.programId, { tab: "sign-ups" }))
  revalidatePath("/sign-ups/overview")
  return { success: true }
}
