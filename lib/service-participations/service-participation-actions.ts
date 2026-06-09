"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import type { EventServiceRequirementsFormState } from "@/lib/events/event-service-requirements"
import {
  buildServiceRequirementsPayload,
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
  ServiceParticipationSourceType,
  ServiceParticipationStatus,
  ServiceParticipationType,
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
    revalidatePath(`/programs/${sourceId}/edit`)
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
    .select("id, requires_childcare")
    .eq("organization_id", organizationId)
    .eq("id", input.sourceId)
    .eq("status", statusFilter)
    .maybeSingle()

  if (sourceError || !source?.requires_childcare) {
    throw new Error("Childcare is not available for this opportunity.")
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

  const { error } = await supabase.from("childcare_registrations").insert({
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

  if (error) {
    throw new Error(error.message || "Could not register child.")
  }

  revalidateParticipationPaths(input.sourceType, input.sourceId)
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

  revalidatePath(`/programs/${input.programId}/edit`)
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
