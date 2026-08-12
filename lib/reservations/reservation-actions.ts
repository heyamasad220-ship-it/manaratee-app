"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

import type { CalendarAudience } from "./calendar-audience"
import { getCalendarData, getConflictingReservations } from "./reservation-queries"
import {
  combineDateAndTime,
  parseCalendarDate,
} from "./reservation-time"
import { RESERVATION_SOURCE_TYPES } from "./reservation-types"
import type { CalendarViewMode } from "./reservation-types"
import { syncOperationalBriefForMaintenanceReservation } from "@/lib/operational-briefs/operational-brief-queries"

type CreateBlockInput = {
  sourceType:
    | typeof RESERVATION_SOURCE_TYPES.maintenanceBlock
    | typeof RESERVATION_SOURCE_TYPES.spaceClosure
  venueId?: string | null
  spaceLabel?: string | null
  title: string
  description?: string | null
  eventDate: string
  startTime: string
  endTime: string
}

const CALENDAR_REVALIDATE_PATHS = [
  "/facilities/availability",
  "/facilities/calendar",
  "/bookings/calendar",
  "/event-management",
  "/workforce/departments/calendar",
]

function revalidateCalendars() {
  for (const path of CALENDAR_REVALIDATE_PATHS) {
    revalidatePath(path)
  }
}

export async function loadCalendarData(input: {
  audience: CalendarAudience
  date?: string
  view?: CalendarViewMode
}) {
  const anchorDate = parseCalendarDate(input.date)
  const view = input.view === "day" ? "day" : "grid"
  return getCalendarData(input.audience, anchorDate, view)
}

export async function createReservationBlock(input: CreateBlockInput) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canManage) {
    throw new Error("You do not have permission to create reservation blocks.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const title = input.title.trim()
  if (!title) {
    throw new Error("Title is required.")
  }

  if (!input.venueId && !input.spaceLabel?.trim()) {
    throw new Error("Select a venue or provide a space label.")
  }

  const date = parseCalendarDate(input.eventDate)
  const startAt = combineDateAndTime(date, input.startTime)
  let endAt = combineDateAndTime(date, input.endTime)

  if (endAt <= startAt) {
    endAt = new Date(startAt.getTime() + 60 * 60 * 1000)
  }

  const conflicts = await getConflictingReservations(
    organizationId,
    input.venueId ?? null,
    input.spaceLabel?.trim() || null,
    startAt.toISOString(),
    endAt.toISOString()
  )

  if (conflicts.length > 0) {
    throw new Error(
      `This block overlaps ${conflicts.length} existing reservation${conflicts.length === 1 ? "" : "s"}.`
    )
  }

  const { data: inserted, error } = await supabase.from("resource_reservations").insert({
    organization_id: organizationId,
    venue_id: input.venueId || null,
    space_label: input.spaceLabel?.trim() || null,
    title,
    description: input.description?.trim() || null,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    source_type: input.sourceType,
    source_id: null,
    status: "active",
    metadata: {},
  }).select("id").single()

  if (error) {
    console.error(error)
    if (error.code === "42P01") {
      throw new Error(
        "Reservation engine is not installed yet. Run scripts/040_resource_reservations.sql in Supabase."
      )
    }
    throw new Error("Failed to create reservation block")
  }

  if (inserted?.id) {
    await syncOperationalBriefForMaintenanceReservation(inserted.id, organizationId)
  }

  revalidateCalendars()
}
