"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, hasFacilitiesOnlyAccess, PERMISSIONS } from "@/lib/permissions/permissions"
import type { CalendarReservation } from "@/lib/reservations/reservation-types"

import {
  assertNoFinancialFields,
  reservationSourceToBriefSource,
  toOperationalBriefView,
} from "./operational-brief-payload"
import {
  getOperationalBriefById,
  getOperationalBriefByReservationId,
  getOperationalBriefBySource,
} from "./operational-brief-queries"
import {
  syncOperationalBriefForInternalEvent,
  syncOperationalBriefForMaintenanceReservation,
  syncOperationalBriefForProgramSchedule,
  syncOperationalBriefForVenueRental,
} from "./operational-brief-queries"
import {
  OPERATIONAL_BRIEF_SETUP_STATUSES,
  OPERATIONAL_BRIEF_SOURCE_TYPES,
  type OperationalBriefPermissionContext,
  type OperationalBriefSetupStatus,
  type OperationalBriefView,
} from "./operational-brief-types"

async function buildPermissionContext(): Promise<OperationalBriefPermissionContext> {
  const [
    isFacilitiesOnly,
    canOpenVenueRentalRecord,
    canOpenInternalEventRecord,
    canOpenProgramRecord,
    canManageSpaces,
    canManageBusinessModules,
  ] = await Promise.all([
    hasFacilitiesOnlyAccess(),
    hasAnyPermission(PERMISSIONS.BOOKINGS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    hasAnyPermission(PERMISSIONS.PROGRAMS_MANAGE),
    hasAnyPermission(PERMISSIONS.SPACES_MANAGE),
    hasAnyPermission(
      PERMISSIONS.BOOKINGS_MANAGE,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    ),
  ])

  const canEditSetupFields = isFacilitiesOnly
    ? canManageSpaces
    : canManageSpaces || canManageBusinessModules

  return {
    isFacilitiesOnly,
    canOpenVenueRentalRecord: !isFacilitiesOnly && canOpenVenueRentalRecord,
    canOpenInternalEventRecord: !isFacilitiesOnly && canOpenInternalEventRecord,
    canOpenProgramRecord: !isFacilitiesOnly && canOpenProgramRecord,
    canEditSetupFields,
  }
}

async function assertCanViewOperationalBriefs() {
  const canView = await hasAnyPermission(
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.PROGRAMS_VIEW
  )

  if (!canView) {
    throw new Error("You do not have permission to view operational briefs.")
  }
}

function extractSpacesLabel(
  facilityNotes: string | null,
  reservation: Pick<CalendarReservation, "venueName" | "spaceLabel">
) {
  if (facilityNotes?.startsWith("Spaces: ")) {
    return facilityNotes.slice("Spaces: ".length)
  }
  return [reservation.venueName, reservation.spaceLabel].filter(Boolean).join(", ") || null
}

async function ensureBriefForReservation(
  reservation: CalendarReservation
): Promise<string | null> {
  const briefSource = reservationSourceToBriefSource(reservation.sourceType)
  if (!briefSource) return null

  if (briefSource === OPERATIONAL_BRIEF_SOURCE_TYPES.internalEvent && reservation.sourceId) {
    await syncOperationalBriefForInternalEvent(
      reservation.sourceId,
      reservation.organizationId
    )
    return reservation.sourceId
  }

  if (briefSource === OPERATIONAL_BRIEF_SOURCE_TYPES.venueRental) {
    const venueRentalId =
      typeof reservation.metadata.venue_rental_id === "string"
        ? reservation.metadata.venue_rental_id
        : reservation.sourceId

    if (venueRentalId) {
      await syncOperationalBriefForVenueRental(venueRentalId, reservation.organizationId)
      return venueRentalId
    }
  }

  if (briefSource === OPERATIONAL_BRIEF_SOURCE_TYPES.program) {
    const programId =
      typeof reservation.metadata.program_id === "string"
        ? reservation.metadata.program_id
        : reservation.sourceId

    if (programId) {
      await syncOperationalBriefForProgramSchedule({
        programId,
        programName:
          typeof reservation.metadata.program_name === "string"
            ? reservation.metadata.program_name
            : reservation.title,
        scheduleTitle:
          typeof reservation.metadata.schedule_title === "string"
            ? reservation.metadata.schedule_title
            : reservation.title,
        location: reservation.spaceLabel,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        reservationId: reservation.id,
        organizationId: reservation.organizationId,
      })
      return programId
    }
  }

  if (briefSource === OPERATIONAL_BRIEF_SOURCE_TYPES.maintenance) {
    await syncOperationalBriefForMaintenanceReservation(
      reservation.id,
      reservation.organizationId
    )
    return reservation.id
  }

  return null
}

export async function loadOperationalBriefForReservationAction(
  reservation: CalendarReservation
): Promise<OperationalBriefView | null> {
  await assertCanViewOperationalBriefs()

  await ensureBriefForReservation(reservation)

  const briefSource = reservationSourceToBriefSource(reservation.sourceType)
  if (!briefSource) return null

  let brief = await getOperationalBriefByReservationId(reservation.id)

  if (!brief) {
    const sourceKey =
      briefSource === OPERATIONAL_BRIEF_SOURCE_TYPES.program
        ? typeof reservation.metadata.program_id === "string"
          ? reservation.metadata.program_id
          : null
        : briefSource === OPERATIONAL_BRIEF_SOURCE_TYPES.venueRental
          ? typeof reservation.metadata.venue_rental_id === "string"
            ? reservation.metadata.venue_rental_id
            : reservation.sourceId
          : reservation.sourceId

    if (sourceKey) {
      brief = await getOperationalBriefBySource(briefSource, sourceKey)
    }
  }

  if (!brief) return null

  const permissions = await buildPermissionContext()

  return toOperationalBriefView(brief, permissions, {
    spacesLabel: extractSpacesLabel(brief.facility_notes, reservation),
    metadata: reservation.metadata,
  })
}

export async function updateOperationalBriefSetupAction(input: {
  briefId: string
  setupStatus?: OperationalBriefSetupStatus
  setupStyle?: string | null
  roomSetupNotes?: string | null
  equipmentNotes?: string | null
  foodBeverageNotes?: string | null
  tableLinenNotes?: string | null
  cleanupNotes?: string | null
  accessibilityNotes?: string | null
  facilityNotes?: string | null
}) {
  assertNoFinancialFields(input as Record<string, unknown>)

  const permissions = await buildPermissionContext()
  if (!permissions.canEditSetupFields) {
    throw new Error("You do not have permission to update operational brief setup fields.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("operational_briefs")
    .update({
      ...(input.setupStatus !== undefined
        ? { setup_status: input.setupStatus }
        : {}),
      ...(input.setupStyle !== undefined ? { setup_style: input.setupStyle } : {}),
      ...(input.roomSetupNotes !== undefined
        ? { room_setup_notes: input.roomSetupNotes }
        : {}),
      ...(input.equipmentNotes !== undefined
        ? { equipment_notes: input.equipmentNotes }
        : {}),
      ...(input.foodBeverageNotes !== undefined
        ? { food_beverage_notes: input.foodBeverageNotes }
        : {}),
      ...(input.tableLinenNotes !== undefined
        ? { table_linen_notes: input.tableLinenNotes }
        : {}),
      ...(input.cleanupNotes !== undefined ? { cleanup_notes: input.cleanupNotes } : {}),
      ...(input.accessibilityNotes !== undefined
        ? { accessibility_notes: input.accessibilityNotes }
        : {}),
      ...(input.facilityNotes !== undefined
        ? { facility_notes: input.facilityNotes }
        : {}),
      updated_by: user?.id ?? null,
    })
    .eq("id", input.briefId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to update operational brief.")
  }

  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/reservation-center")
  revalidatePath("/facilities/overview")
}

export async function getOperationalBriefViewByIdAction(
  briefId: string
): Promise<OperationalBriefView | null> {
  await assertCanViewOperationalBriefs()

  const brief = await getOperationalBriefById(briefId)
  if (!brief) return null

  const permissions = await buildPermissionContext()
  return toOperationalBriefView(brief, permissions)
}
