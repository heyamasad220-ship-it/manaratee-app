import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

import {
  isSignUpOverviewStatusVisible,
  signUpOverviewSource,
  volunteerSlotsNeeded,
  type SignUpOverviewEvent,
} from "@/lib/sign-ups/sign-up-overview"

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  const message = (error?.message || "").toLowerCase()
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    (message.includes("column") && message.includes("does not exist"))
  )
}

type EventRow = {
  id: string
  name: string | null
  start_at: string | null
  end_at: string | null
  location_label: string | null
  status: string | null
  source_module?: string | null
  service_requirements?: unknown
}

type BazaarRow = {
  id: string
  name: string | null
  internal_event_id: string | null
  location: string | null
}

export async function getSignUpOverviewEvents(): Promise<SignUpOverviewEvent[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const eventSelect =
    "id, name, start_at, end_at, location_label, status, source_module, service_requirements"

  let eventsResult = await supabase
    .from("internal_events")
    .select(eventSelect)
    .eq("organization_id", organizationId)
    .eq("requires_volunteers", true)

  if (isMissingColumnError(eventsResult.error)) {
    eventsResult = await supabase
      .from("internal_events")
      .select(
        "id, name, start_at, end_at, location_label, status, service_requirements"
      )
      .eq("organization_id", organizationId)
      .eq("requires_volunteers", true)
  }

  if (eventsResult.error) {
    console.error("getSignUpOverviewEvents:", eventsResult.error.message)
    return []
  }

  const events = ((eventsResult.data || []) as EventRow[]).filter((event) =>
    isSignUpOverviewStatusVisible(event.status)
  )

  const eventIds = events.map((event) => event.id)
  const [bazaarsResult, assignmentsResult] = eventIds.length
    ? await Promise.all([
        supabase
          .from("vendor_hub_events")
          .select("id, name, internal_event_id, location")
          .eq("organization_id", organizationId)
          .in("internal_event_id", eventIds),
        supabase
          .from("service_participations")
          .select("source_id, status")
          .eq("organization_id", organizationId)
          .eq("source_type", "internal_event")
          .eq("participation_type", "volunteer")
          .in("source_id", eventIds)
          .in("status", ["pending", "confirmed"]),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]

  if (bazaarsResult.error) {
    console.error("getSignUpOverviewEvents bazaars:", bazaarsResult.error.message)
  }
  if (assignmentsResult.error) {
    console.error(
      "getSignUpOverviewEvents assignments:",
      assignmentsResult.error.message
    )
  }

  const bazaarByInternalId = new Map<string, BazaarRow>()
  for (const row of (bazaarsResult.data || []) as BazaarRow[]) {
    if (row.internal_event_id) {
      bazaarByInternalId.set(row.internal_event_id, row)
    }
  }

  const filledByEventId = new Map<string, number>()
  for (const row of assignmentsResult.data || []) {
    const sourceId = row.source_id as string
    filledByEventId.set(sourceId, (filledByEventId.get(sourceId) || 0) + 1)
  }

  const rows: SignUpOverviewEvent[] = events.map((event) => {
    const bazaar = bazaarByInternalId.get(event.id)
    const source = bazaar
      ? "vendor-hub"
      : signUpOverviewSource(event.source_module)
    const name =
      (source === "vendor-hub" ? bazaar?.name : event.name)?.trim() ||
      event.name?.trim() ||
      "Untitled event"

    return {
      id: event.id,
      name,
      source,
      href:
        source === "vendor-hub" && bazaar
          ? VENDOR_HUB_ROUTES.events.detail(bazaar.id)
          : `/event-management/${event.id}`,
      startAt: event.start_at,
      endAt: event.end_at,
      location:
        event.location_label?.trim() ||
        bazaar?.location?.trim() ||
        null,
      status: event.status || "draft",
      volunteersFilled: filledByEventId.get(event.id) || 0,
      volunteersNeeded: volunteerSlotsNeeded(event.service_requirements),
    }
  })

  const programsResult = await supabase
    .from("programs")
    .select("id, name, start_date, end_date, status, service_requirements")
    .eq("organization_id", organizationId)
    .eq("requires_volunteers", true)
    .neq("status", "archived")

  if (programsResult.error && !isMissingColumnError(programsResult.error)) {
    console.error("getSignUpOverviewEvents programs:", programsResult.error.message)
  }

  const programs = (programsResult.error ? [] : programsResult.data || []) as Array<{
    id: string
    name: string | null
    start_date: string | null
    end_date: string | null
    status: string | null
    service_requirements?: unknown
  }>

  if (programs.length > 0) {
    const programIds = programs.map((program) => program.id)
    const programAssignments = await supabase
      .from("service_participations")
      .select("source_id")
      .eq("organization_id", organizationId)
      .eq("source_type", "program")
      .eq("participation_type", "volunteer")
      .in("source_id", programIds)
      .in("status", ["pending", "confirmed"])

    const filledByProgramId = new Map<string, number>()
    for (const row of programAssignments.data || []) {
      const sourceId = row.source_id as string
      filledByProgramId.set(sourceId, (filledByProgramId.get(sourceId) || 0) + 1)
    }

    for (const program of programs) {
      rows.push({
        id: program.id,
        name: program.name?.trim() || "Untitled program",
        source: "programs",
        href: programWorkspaceHref(program.id, { tab: "sign-ups" }),
        startAt: program.start_date ? `${program.start_date}T00:00:00` : null,
        endAt: program.end_date ? `${program.end_date}T23:59:59` : null,
        location: null,
        status: program.status || "active",
        volunteersFilled: filledByProgramId.get(program.id) || 0,
        volunteersNeeded: volunteerSlotsNeeded(program.service_requirements),
      })
    }
  }

  if (rows.length === 0) return []

  rows.sort((left, right) => {
    const leftTime = left.startAt ? new Date(left.startAt).getTime() : Number.MAX_SAFE_INTEGER
    const rightTime = right.startAt
      ? new Date(right.startAt).getTime()
      : Number.MAX_SAFE_INTEGER
    if (leftTime !== rightTime) return leftTime - rightTime
    return left.name.localeCompare(right.name)
  })

  return rows
}
