"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import type { EventServiceRequirementsFormState } from "@/lib/events/event-service-requirements"
import {
  buildServiceRequirementsPayload,
  parseServiceRequirements,
  serviceRequirementsFormFromEvent,
} from "@/lib/events/event-service-requirements"

import { ensureChildcareEventForSource } from "./childcare-source-sync"
import {
  eligibleTypesForOpportunity,
  getContactServiceEligibility,
  opportunityNeedsType,
  resolveContactIdForAuthUser,
} from "./service-participation-eligibility"
import type {
  EventStaffAssignmentMeta,
  ServiceParticipationSourceType,
  ServiceParticipationStatus,
  ServiceParticipationType,
} from "./service-participation-types"
import {
  mergeEventStaffAssignmentMeta,
  parseEventStaffAssignmentMeta,
} from "./service-participation-types"

function revalidateParticipationPaths(
  sourceType?: ServiceParticipationSourceType,
  sourceId?: string
) {
  revalidatePath("/customer/opportunities")
  if (sourceType === "internal_event" && sourceId) {
    revalidatePath(`/event-management/${sourceId}`)
  }
  if (sourceType === "program" && sourceId) {
    revalidatePath(`/programs/${sourceId}`)
  }
}

export async function submitServiceParticipation(input: {
  sourceType: ServiceParticipationSourceType
  sourceId: string
  participationType: ServiceParticipationType
  volunteerRole?: string | null
  notes?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { activeOrganization } = await getActiveOrganization()
  const organizationId = activeOrganization?.organization_id

  if (!user || !organizationId) {
    throw new Error("You must be signed in.")
  }

  const contactId = await resolveContactIdForAuthUser(supabase, organizationId, user.id)
  if (!contactId) {
    throw new Error("No contact profile found for your account.")
  }

  const eligibility = await getContactServiceEligibility(
    supabase,
    organizationId,
    contactId
  )

  if (!eligibility.participationTypes.includes(input.participationType)) {
    throw new Error("You are not eligible to sign up for this role.")
  }

  const sourceTable =
    input.sourceType === "internal_event" ? "internal_events" : "programs"
  const statusFilter =
    input.sourceType === "internal_event" ? "confirmed" : "active"

  const { data: source, error: sourceError } = await supabase
    .from(sourceTable)
    .select(
      "id, requires_volunteers, requires_childcare, requires_vendors, service_requirements"
    )
    .eq("organization_id", organizationId)
    .eq("id", input.sourceId)
    .eq("status", statusFilter)
    .maybeSingle()

  if (sourceError || !source) {
    throw new Error("This opportunity is no longer open.")
  }

  if (!opportunityNeedsType(source, input.participationType)) {
    throw new Error("This opportunity does not accept that participation type.")
  }

  const eligible = eligibleTypesForOpportunity(source, eligibility)
  if (!eligible.includes(input.participationType)) {
    throw new Error("You cannot sign up for this opportunity.")
  }

  const { error } = await supabase.from("service_participations").insert({
    organization_id: organizationId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    contact_id: contactId,
    participation_type: input.participationType,
    volunteer_role: input.volunteerRole?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "pending",
  })

  if (error) {
    if (error.code === "23505") {
      throw new Error("You have already signed up for this opportunity.")
    }
    throw new Error(error.message || "Could not submit sign-up.")
  }

  revalidateParticipationPaths(input.sourceType, input.sourceId)
}

export async function registerChildForOpportunityChildcare(input: {
  sourceType: ServiceParticipationSourceType
  sourceId: string
  childName: string
  childAge?: number | null
  allergies?: string | null
  notes?: string | null
  photoConsent?: boolean | null
  waiverSigned?: boolean
  waiverSignedBy?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { activeOrganization } = await getActiveOrganization()
  const organizationId = activeOrganization?.organization_id

  if (!user || !organizationId) {
    throw new Error("You must be signed in.")
  }

  if (!input.childName.trim()) {
    throw new Error("Child name is required.")
  }

  const contactId = await resolveContactIdForAuthUser(supabase, organizationId, user.id)
  if (!contactId) {
    throw new Error("No contact profile found for your account.")
  }

  const sourceTable =
    input.sourceType === "internal_event" ? "internal_events" : "programs"
  const statusFilter =
    input.sourceType === "internal_event" ? "confirmed" : "active"

  const { data: source, error: sourceError } = await supabase
    .from(sourceTable)
    .select("id, requires_childcare, service_requirements")
    .eq("organization_id", organizationId)
    .eq("id", input.sourceId)
    .eq("status", statusFilter)
    .maybeSingle()

  if (sourceError || !source?.requires_childcare) {
    throw new Error("Childcare is not available for this opportunity.")
  }

  const childcareConfig = parseServiceRequirements(source.service_requirements).childcare
  const questionsOn =
    !childcareConfig?.groups?.length ||
    childcareConfig.groups.every((group) => group.includeYouthQuestions !== false)
  const requireWaiver = childcareConfig?.requireWaiver === true

  if (questionsOn && !(input.allergies || "").trim()) {
    throw new Error("Please enter allergies or medical notes (or write None).")
  }
  if (questionsOn && input.photoConsent !== true) {
    throw new Error("Photo consent is required for this youth registration.")
  }
  if (requireWaiver && !input.waiverSigned) {
    throw new Error("Please sign the liability waiver to continue.")
  }

  const childcareEventId = await ensureChildcareEventForSource(supabase, {
    organizationId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  })

  const { data: profile } = await supabase
    .from("contacts")
    .select("full_name, email, phone")
    .eq("id", contactId)
    .maybeSingle()

  const now = new Date().toISOString()
  const formFields = {
    photo_consent: input.photoConsent === true ? true : input.photoConsent === false ? false : null,
    waiver_signed_at: input.waiverSigned ? now : null,
    waiver_signed_by: input.waiverSigned
      ? input.waiverSignedBy?.trim() ||
        (profile?.full_name as string | null) ||
        null
      : null,
  }

  const payload = {
    organization_id: organizationId,
    childcare_event_id: childcareEventId,
    parent_contact_id: contactId,
    child_name: input.childName.trim(),
    child_age: input.childAge ?? null,
    parent_name: (profile?.full_name as string | null) ?? null,
    parent_email: (profile?.email as string | null) ?? null,
    parent_phone: (profile?.phone as string | null) ?? null,
    allergies: input.allergies?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "pending",
    ...formFields,
  }

  const { error } = await supabase.from("childcare_registrations").insert(payload)

  if (error?.code === "42703") {
    const { error: fallbackError } = await supabase.from("childcare_registrations").insert({
      organization_id: organizationId,
      childcare_event_id: childcareEventId,
      parent_contact_id: contactId,
      child_name: input.childName.trim(),
      child_age: input.childAge ?? null,
      parent_name: (profile?.full_name as string | null) ?? null,
      parent_email: (profile?.email as string | null) ?? null,
      parent_phone: (profile?.phone as string | null) ?? null,
      allergies: input.allergies?.trim() || null,
      notes: input.notes?.trim() || null,
      status: "pending",
    })
    if (fallbackError) {
      throw new Error(fallbackError.message || "Could not register child.")
    }
  } else if (error) {
    throw new Error(error.message || "Could not register child.")
  }

  revalidateParticipationPaths(input.sourceType, input.sourceId)
  revalidatePath("/programs/reports/childcare")
  revalidatePath("/workforce/childcare/registrations")
}

export async function updateServiceParticipationStatus(input: {
  participationId: string
  status: ServiceParticipationStatus
}) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canManage) {
    throw new Error("You do not have permission to manage participations.")
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected.")
  }

  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from("service_participations")
    .select("id, source_type, source_id")
    .eq("organization_id", organizationId)
    .eq("id", input.participationId)
    .maybeSingle()

  if (existingError || !existing) {
    throw new Error("Participation not found.")
  }

  const { error } = await supabase
    .from("service_participations")
    .update({ status: input.status })
    .eq("organization_id", organizationId)
    .eq("id", input.participationId)

  if (error) {
    throw new Error(error.message || "Could not update participation.")
  }

  revalidateParticipationPaths(
    existing.source_type as ServiceParticipationSourceType,
    existing.source_id as string
  )
}

/** Manager assigns a paid worker or volunteer to an event task. */
export async function assignEventStaffMember(input: {
  eventId: string
  contactId: string
  /** Paid = staff participation_type; Volunteer = volunteer */
  compensation: "paid" | "volunteer"
  task: string
  hourlyRate?: number | null
  hours?: number | null
  actualHours?: number | null
  shiftId?: string | null
  shiftLabel?: string | null
  notes?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to assign staff." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const task = input.task.trim()
    if (!task) {
      return { success: false, error: "Choose a task." }
    }
    if (!input.contactId) {
      return { success: false, error: "Choose a person." }
    }

    const supabase = await createClient()

    const { data: event, error: eventError } = await supabase
      .from("internal_events")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", input.eventId)
      .maybeSingle()

    if (eventError || !event) {
      return { success: false, error: "Event not found." }
    }

    const participationType: ServiceParticipationType =
      input.compensation === "paid" ? "staff" : "volunteer"

    const assignment_meta: EventStaffAssignmentMeta = {
      hourlyRate:
        input.compensation === "paid" && input.hourlyRate != null
          ? input.hourlyRate
          : null,
      hours: input.hours != null ? input.hours : null,
      actualHours: input.actualHours != null ? input.actualHours : null,
      paidAt: null,
      certificateSentAt: null,
      shiftId: input.shiftId || null,
      shiftLabel: input.shiftLabel || null,
      notes: input.notes || null,
    }

    const payload = {
      organization_id: organizationId,
      source_type: "internal_event" as const,
      source_id: input.eventId,
      contact_id: input.contactId,
      participation_type: participationType,
      volunteer_role: task,
      status: "confirmed" as const,
      assignment_meta,
      updated_at: new Date().toISOString(),
    }

    let { error } = await supabase.from("service_participations").upsert(payload, {
      onConflict:
        "organization_id,source_type,source_id,contact_id,participation_type",
    })

    if (error && (error.code === "PGRST204" || error.message?.includes("assignment_meta"))) {
      const { assignment_meta: _meta, ...withoutMeta } = payload
      ;({ error } = await supabase.from("service_participations").upsert(withoutMeta, {
        onConflict:
          "organization_id,source_type,source_id,contact_id,participation_type",
      }))
    }

    if (error) {
      return { success: false, error: error.message || "Could not save assignment." }
    }

    revalidateParticipationPaths("internal_event", input.eventId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not save assignment.",
    }
  }
}

export async function updateEventStaffAssignment(input: {
  participationId: string
  contactId?: string
  task?: string
  status?: ServiceParticipationStatus
  hourlyRate?: number | null
  hours?: number | null
  actualHours?: number | null
  paidAt?: string | null
  certificateSentAt?: string | null
  shiftId?: string | null
  shiftLabel?: string | null
  notes?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update assignments." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const supabase = await createClient()
    const { data: existing, error: existingError } = await supabase
      .from("service_participations")
      .select("id, source_type, source_id, participation_type, assignment_meta")
      .eq("organization_id", organizationId)
      .eq("id", input.participationId)
      .maybeSingle()

    let existingRow = existing
    if (existingError && isMissingColumnError(existingError)) {
      const legacy = await supabase
        .from("service_participations")
        .select("id, source_type, source_id, participation_type")
        .eq("organization_id", organizationId)
        .eq("id", input.participationId)
        .maybeSingle()
      if (legacy.error || !legacy.data) {
        return { success: false, error: "Assignment not found." }
      }
      existingRow = { ...legacy.data, assignment_meta: {} }
    } else if (existingError || !existing) {
      return { success: false, error: "Assignment not found." }
    }

    if (
      existingRow!.participation_type !== "staff" &&
      existingRow!.participation_type !== "volunteer"
    ) {
      return { success: false, error: "Only paid and volunteer assignments can be edited here." }
    }

    const currentMeta = parseEventStaffAssignmentMeta(existingRow!.assignment_meta)
    const assignment_meta = mergeEventStaffAssignmentMeta(currentMeta, {
      hourlyRate: input.hourlyRate,
      hours: input.hours,
      actualHours: input.actualHours,
      paidAt: input.paidAt,
      certificateSentAt: input.certificateSentAt,
      shiftId: input.shiftId,
      shiftLabel: input.shiftLabel,
      notes: input.notes,
    })

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      assignment_meta,
    }
    if (input.contactId !== undefined) {
      if (!input.contactId.trim()) {
        return { success: false, error: "Choose a person." }
      }
      patch.contact_id = input.contactId.trim()
    }
    if (input.task !== undefined) {
      const task = input.task.trim()
      if (!task) return { success: false, error: "Task is required." }
      patch.volunteer_role = task
    }
    if (input.status) {
      patch.status = input.status
    }

    let { error } = await supabase
      .from("service_participations")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("id", input.participationId)

    if (error && (error.code === "PGRST204" || error.message?.includes("assignment_meta"))) {
      const { assignment_meta: _meta, ...withoutMeta } = patch
      ;({ error } = await supabase
        .from("service_participations")
        .update(withoutMeta)
        .eq("organization_id", organizationId)
        .eq("id", input.participationId))
    }

    if (error) {
      return { success: false, error: error.message || "Could not update assignment." }
    }

    revalidateParticipationPaths(
      existingRow!.source_type as ServiceParticipationSourceType,
      existingRow!.source_id as string
    )
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update assignment.",
    }
  }
}

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  const message = (error?.message || "").toLowerCase()
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    (message.includes("column") && message.includes("does not exist"))
  )
}

export async function updateProgramServiceRequirements(input: {
  programId: string
  form: EventServiceRequirementsFormState
}) {
  const canManage = await hasAnyPermission(PERMISSIONS.PROGRAMS_MANAGE)
  if (!canManage) {
    throw new Error("You do not have permission to update this program.")
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected.")
  }

  const payload = buildServiceRequirementsPayload(input.form)
  const supabase = await createClient()

  const { error } = await supabase
    .from("programs")
    .update({
      requires_volunteers: payload.requires_volunteers,
      requires_childcare: payload.requires_childcare,
      requires_vendors: payload.requires_vendors,
      service_requirements: payload.service_requirements,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", input.programId)

  if (error) {
    throw new Error(error.message || "Could not save program service needs.")
  }

  revalidatePath(`/programs/${input.programId}`)
  revalidatePath("/workforce?tab=departments")
  revalidatePath("/customer/opportunities")
}

export async function loadProgramServiceRequirementsForm(programId: string) {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("programs")
    .select(
      "requires_volunteers, requires_childcare, requires_vendors, service_requirements"
    )
    .eq("organization_id", organizationId)
    .eq("id", programId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return serviceRequirementsFormFromEvent(data)
}
