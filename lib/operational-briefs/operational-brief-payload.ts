import { RESERVATION_SOURCE_TYPES } from "@/lib/reservations/reservation-types"

import {
  OPERATIONAL_BRIEF_SETUP_STATUS_LABELS,
  OPERATIONAL_BRIEF_SOURCE_TYPES,
  type OperationalBriefPermissionContext,
  type OperationalBriefRecord,
  type OperationalBriefSourceType,
  type OperationalBriefView,
} from "./operational-brief-types"

export const FINANCIAL_FIELD_KEYS = [
  "deposit_amount",
  "security_deposit_amount",
  "payment_status",
  "refund",
  "stripe",
  "contract_financial",
  "finance_notes",
] as const

export function reservationSourceToBriefSource(
  sourceType: string
): OperationalBriefSourceType | null {
  switch (sourceType) {
    case RESERVATION_SOURCE_TYPES.internalEvent:
      return OPERATIONAL_BRIEF_SOURCE_TYPES.internalEvent
    case RESERVATION_SOURCE_TYPES.venueRental:
      return OPERATIONAL_BRIEF_SOURCE_TYPES.venueRental
    case RESERVATION_SOURCE_TYPES.programFacility:
      return OPERATIONAL_BRIEF_SOURCE_TYPES.program
    case RESERVATION_SOURCE_TYPES.maintenanceBlock:
    case RESERVATION_SOURCE_TYPES.spaceClosure:
      return OPERATIONAL_BRIEF_SOURCE_TYPES.maintenance
    default:
      return null
  }
}

export function sourceTypeLabel(sourceType: OperationalBriefSourceType): string {
  switch (sourceType) {
    case OPERATIONAL_BRIEF_SOURCE_TYPES.internalEvent:
      return "Internal Event"
    case OPERATIONAL_BRIEF_SOURCE_TYPES.venueRental:
      return "Venue Rental"
    case OPERATIONAL_BRIEF_SOURCE_TYPES.program:
      return "Program"
    case OPERATIONAL_BRIEF_SOURCE_TYPES.maintenance:
      return "Maintenance"
    default:
      return sourceType
  }
}

export function resolveSourceRecordHref(
  brief: Pick<OperationalBriefRecord, "source_type" | "source_id">
): string | null {
  if (!brief.source_id) {
    return null
  }

  switch (brief.source_type) {
    case OPERATIONAL_BRIEF_SOURCE_TYPES.internalEvent:
      return `/event-management/${brief.source_id}`
    case OPERATIONAL_BRIEF_SOURCE_TYPES.venueRental:
      return `/bookings/rentals/${brief.source_id}`
    case OPERATIONAL_BRIEF_SOURCE_TYPES.program:
      return `/programs/${brief.source_id}`
    default:
      return null
  }
}

export function canOpenSourceRecordForBrief(
  brief: Pick<OperationalBriefRecord, "source_type">,
  permissions: OperationalBriefPermissionContext
): boolean {
  switch (brief.source_type) {
    case OPERATIONAL_BRIEF_SOURCE_TYPES.internalEvent:
      return permissions.canOpenInternalEventRecord
    case OPERATIONAL_BRIEF_SOURCE_TYPES.venueRental:
      return permissions.canOpenVenueRentalRecord
    case OPERATIONAL_BRIEF_SOURCE_TYPES.program:
      return permissions.canOpenProgramRecord
    case OPERATIONAL_BRIEF_SOURCE_TYPES.maintenance:
      return permissions.canEditSetupFields
    default:
      return false
  }
}

export function toOperationalBriefView(
  brief: OperationalBriefRecord,
  permissions: OperationalBriefPermissionContext,
  options?: {
    spacesLabel?: string | null
    metadata?: Record<string, unknown> | null
    primaryContactEmail?: string | null
    hideSourceRecordLink?: boolean
  }
): OperationalBriefView {
  const canOpenSourceRecord =
    !options?.hideSourceRecordLink && canOpenSourceRecordForBrief(brief, permissions)
  const href = canOpenSourceRecord ? resolveSourceRecordHref(brief) : null

  return {
    id: brief.id,
    sourceType: brief.source_type,
    sourceTypeLabel: sourceTypeLabel(brief.source_type),
    title: brief.title,
    eventDate: brief.event_date,
    startTime: brief.start_time,
    endTime: brief.end_time,
    spacesLabel: options?.spacesLabel ?? null,
    expectedAttendance: brief.expected_attendance,
    setupStyle: brief.setup_style,
    roomSetupNotes: brief.room_setup_notes,
    equipmentNotes: brief.equipment_notes,
    foodBeverageNotes: brief.food_beverage_notes,
    tableLinenNotes: brief.table_linen_notes,
    cleanupNotes: brief.cleanup_notes,
    accessibilityNotes: brief.accessibility_notes,
    specialRequests: brief.special_requests,
    facilityNotes: brief.facility_notes,
    primaryContactName: brief.primary_contact_name,
    primaryContactPhone: brief.primary_contact_phone,
    primaryContactEmail: options?.primaryContactEmail ?? null,
    internalCoordinatorName: brief.internal_coordinator_name,
    internalCoordinatorPhone: brief.internal_coordinator_phone,
    internalCoordinatorEmail: brief.internal_coordinator_email,
    setupStatus: brief.setup_status,
    setupStatusLabel: OPERATIONAL_BRIEF_SETUP_STATUS_LABELS[brief.setup_status],
    sourceStatus: brief.source_status,
    sourceRecordHref: href,
    canOpenSourceRecord,
    canEditSetupFields: permissions.canEditSetupFields,
    isFacilitiesOnly: permissions.isFacilitiesOnly,
  }
}

/** Guard against accidental financial keys in brief payloads (table has none; defensive for future). */
export function assertNoFinancialFields(payload: Record<string, unknown>) {
  const blocked = /deposit|payment|refund|stripe|finance|contract_amount/i
  for (const key of Object.keys(payload)) {
    if (blocked.test(key)) {
      throw new Error(`Financial field "${key}" is not allowed on operational brief payloads.`)
    }
  }
}
