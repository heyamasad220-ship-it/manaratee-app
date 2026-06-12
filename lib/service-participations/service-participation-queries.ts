import { parseServiceRequirements } from "@/lib/events/event-service-requirements"
import { createClient } from "@/lib/supabase/server"
import { resolveCustomerPortalActor } from "@/lib/auth/customer-portal-session"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

import {
  eligibleTypesForOpportunity,
  getContactServiceEligibility,
  resolveContactIdForAuthUser,
} from "./service-participation-eligibility"
import type {
  ServiceOpportunity,
  ServiceParticipationSourceType,
  ServiceParticipationType,
  ServiceParticipationWithContact,
} from "./service-participation-types"

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  const message = (error?.message || "").toLowerCase()
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    (message.includes("column") && message.includes("does not exist"))
  )
}

export async function getServiceOpportunitiesForCurrentUser(): Promise<{
  opportunities: ServiceOpportunity[]
  eligibility: Awaited<ReturnType<typeof getContactServiceEligibility>> | null
}> {
  const actor = await resolveCustomerPortalActor()
  const { activeOrganization } = await getActiveOrganization()
  const organizationId = activeOrganization?.organization_id

  if (!actor || !organizationId) {
    return { opportunities: [], eligibility: null }
  }

  const { userId, supabase } = actor

  const contactId = await resolveContactIdForAuthUser(supabase, organizationId, userId)
  if (!contactId) {
    return { opportunities: [], eligibility: null }
  }

  const eligibility = await getContactServiceEligibility(
    supabase,
    organizationId,
    contactId
  )

  const [eventsResult, programsResult, participationsResult, childcareEventsResult] =
    await Promise.all([
      supabase
        .from("internal_events")
        .select(
          "id, name, description, start_at, end_at, location_label, requires_volunteers, requires_childcare, requires_vendors, service_requirements"
        )
        .eq("organization_id", organizationId)
        .eq("status", "confirmed"),
      supabase
        .from("programs")
        .select(
          "id, name, description, start_date, end_date, requires_volunteers, requires_childcare, requires_vendors, service_requirements"
        )
        .eq("organization_id", organizationId)
        .eq("status", "active"),
      supabase
        .from("service_participations")
        .select("source_type, source_id, participation_type, status")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .in("status", ["pending", "confirmed"]),
      supabase
        .from("childcare_events")
        .select("id, source_type, source_id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .not("source_id", "is", null),
    ])

  if (
    isMissingColumnError(eventsResult.error) ||
    isMissingColumnError(programsResult.error)
  ) {
    return { opportunities: [], eligibility }
  }

  const myParticipationKey = (sourceType: string, sourceId: string, type: string) =>
    `${sourceType}:${sourceId}:${type}`

  const myParticipations = new Set<string>()
  for (const row of participationsResult.data || []) {
    if (row.status === "cancelled" || row.status === "declined") continue
    myParticipations.add(
      myParticipationKey(
        row.source_type as string,
        row.source_id as string,
        row.participation_type as string
      )
    )
  }

  const childcareEventBySource = new Map<string, string>()
  for (const row of childcareEventsResult.data || []) {
    childcareEventBySource.set(
      `${row.source_type}:${row.source_id}`,
      row.id as string
    )
  }

  const opportunities: ServiceOpportunity[] = []

  for (const event of eventsResult.data || []) {
    if (
      !event.requires_volunteers &&
      !event.requires_childcare &&
      !event.requires_vendors
    ) {
      continue
    }

    const eligibleParticipationTypes = eligibleTypesForOpportunity(event, eligibility)
    const sourceKey = `internal_event:${event.id}`
    const myParticipationTypes = (
      ["volunteer", "childcare_provider", "vendor"] as ServiceParticipationType[]
    ).filter(
      (type) =>
        myParticipations.has(myParticipationKey("internal_event", event.id as string, type))
    )

    const showForProviderOrVolunteer = eligibleParticipationTypes.length > 0
    const showForParentChildcare = event.requires_childcare === true

    if (!showForProviderOrVolunteer && !showForParentChildcare) {
      continue
    }

    opportunities.push({
      sourceType: "internal_event",
      sourceId: event.id as string,
      title: event.name as string,
      description: (event.description as string | null) ?? null,
      startsAt: (event.start_at as string | null) ?? null,
      endsAt: (event.end_at as string | null) ?? null,
      locationLabel: (event.location_label as string | null) ?? null,
      requiresVolunteers: event.requires_volunteers === true,
      requiresChildcare: event.requires_childcare === true,
      requiresVendors: event.requires_vendors === true,
      serviceRequirements: parseServiceRequirements(event.service_requirements),
      eligibleParticipationTypes,
      myParticipationTypes,
      childcareEventId: childcareEventBySource.get(sourceKey) ?? null,
    })
  }

  for (const program of programsResult.data || []) {
    if (
      !program.requires_volunteers &&
      !program.requires_childcare &&
      !program.requires_vendors
    ) {
      continue
    }

    const eligibleParticipationTypes = eligibleTypesForOpportunity(program, eligibility)
    const sourceKey = `program:${program.id}`
    const myParticipationTypes = (
      ["volunteer", "childcare_provider", "vendor"] as ServiceParticipationType[]
    ).filter(
      (type) =>
        myParticipations.has(myParticipationKey("program", program.id as string, type))
    )

    const showForProviderOrVolunteer = eligibleParticipationTypes.length > 0
    const showForParentChildcare = program.requires_childcare === true

    if (!showForProviderOrVolunteer && !showForParentChildcare) {
      continue
    }

    opportunities.push({
      sourceType: "program",
      sourceId: program.id as string,
      title: program.name as string,
      description: (program.description as string | null) ?? null,
      startsAt: program.start_date ? `${program.start_date}T00:00:00.000Z` : null,
      endsAt: program.end_date ? `${program.end_date}T23:59:59.999Z` : null,
      locationLabel: null,
      requiresVolunteers: program.requires_volunteers === true,
      requiresChildcare: program.requires_childcare === true,
      requiresVendors: program.requires_vendors === true,
      serviceRequirements: parseServiceRequirements(program.service_requirements),
      eligibleParticipationTypes,
      myParticipationTypes,
      childcareEventId: childcareEventBySource.get(sourceKey) ?? null,
    })
  }

  opportunities.sort((a, b) => {
    const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.MAX_SAFE_INTEGER
    const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.MAX_SAFE_INTEGER
    return aTime - bTime
  })

  return { opportunities, eligibility }
}

export async function getParticipationsForSource(input: {
  sourceType: ServiceParticipationSourceType
  sourceId: string
  organizationId?: string
}): Promise<ServiceParticipationWithContact[]> {
  const supabase = await createClient()
  const organizationId = input.organizationId ?? (await getSelectedOrganizationId())

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("service_participations")
    .select(
      "id, organization_id, source_type, source_id, contact_id, participation_type, volunteer_role, notes, status, created_at, updated_at, contacts ( full_name, email )"
    )
    .eq("organization_id", organizationId)
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .order("created_at", { ascending: false })

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return []
    }
    throw new Error(error.message)
  }

  return (data || []).map((row) => {
    const contact = row.contacts as { full_name?: string; email?: string | null } | null
    return {
      id: row.id as string,
      organization_id: row.organization_id as string,
      source_type: row.source_type as ServiceParticipationSourceType,
      source_id: row.source_id as string,
      contact_id: row.contact_id as string,
      participation_type: row.participation_type as ServiceParticipationType,
      volunteer_role: (row.volunteer_role as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      status: row.status as ServiceParticipationWithContact["status"],
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      contact_name: contact?.full_name || "Unknown",
      contact_email: contact?.email ?? null,
    }
  })
}
