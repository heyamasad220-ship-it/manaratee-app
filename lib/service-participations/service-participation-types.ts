import type { EventServiceRequirements } from "@/lib/events/event-service-requirements"

export type ServiceParticipationSourceType = "internal_event" | "program"

export type ServiceParticipationType =
  | "volunteer"
  | "childcare_provider"
  | "vendor"
  | "staff"

export type ServiceParticipationStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"

export type ServiceParticipation = {
  id: string
  organization_id: string
  source_type: ServiceParticipationSourceType
  source_id: string
  contact_id: string
  participation_type: ServiceParticipationType
  volunteer_role: string | null
  notes: string | null
  /** Event staff tab: rate, hours, paid date, certificate */
  assignment_meta?: EventStaffAssignmentMeta | null
  status: ServiceParticipationStatus
  created_at: string
  updated_at: string
}

/** Paid / volunteer assignment extras on event Staff tab. */
export type EventStaffAssignmentMeta = {
  hourlyRate?: number | null
  /** Planned / logged hours */
  hours?: number | null
  /** Actual hours worked (optional; defaults to hours) */
  actualHours?: number | null
  paidAt?: string | null
  certificateSentAt?: string | null
  shiftId?: string | null
  shiftLabel?: string | null
  notes?: string | null
}

export type ServiceParticipationWithContact = ServiceParticipation & {
  contact_name: string
  contact_email: string | null
}

export type ServiceOpportunity = {
  sourceType: ServiceParticipationSourceType
  sourceId: string
  title: string
  description: string | null
  startsAt: string | null
  endsAt: string | null
  locationLabel: string | null
  requiresVolunteers: boolean
  requiresChildcare: boolean
  requiresVendors: boolean
  serviceRequirements: EventServiceRequirements
  /** Participation types the current user may sign up for on this opportunity */
  eligibleParticipationTypes: ServiceParticipationType[]
  /** Types the user already signed up for (pending or confirmed) */
  myParticipationTypes: ServiceParticipationType[]
  childcareEventId: string | null
}

export const SERVICE_PARTICIPATION_TYPE_LABELS: Record<ServiceParticipationType, string> = {
  volunteer: "Volunteer",
  childcare_provider: "Childcare provider",
  vendor: "Vendor",
  staff: "Paid",
}

export function parseEventStaffAssignmentMeta(
  value: unknown
): EventStaffAssignmentMeta {
  if (!value || typeof value !== "object") return {}
  const row = value as Record<string, unknown>
  const hourlyRate = parseOptionalNumber(row.hourlyRate)
  const hours = parseOptionalNumber(row.hours)
  const actualHours = parseOptionalNumber(row.actualHours)
  return {
    hourlyRate: hourlyRate != null && Number.isFinite(hourlyRate) ? hourlyRate : null,
    hours: hours != null && Number.isFinite(hours) ? hours : null,
    actualHours:
      actualHours != null && Number.isFinite(actualHours) ? actualHours : null,
    paidAt: typeof row.paidAt === "string" && row.paidAt ? row.paidAt : null,
    certificateSentAt:
      typeof row.certificateSentAt === "string" && row.certificateSentAt
        ? row.certificateSentAt
        : null,
    shiftId: typeof row.shiftId === "string" && row.shiftId ? row.shiftId : null,
    shiftLabel:
      typeof row.shiftLabel === "string" && row.shiftLabel ? row.shiftLabel : null,
    notes: typeof row.notes === "string" && row.notes ? row.notes : null,
  }
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function mergeEventStaffAssignmentMeta(
  current: EventStaffAssignmentMeta | null | undefined,
  patch: Partial<EventStaffAssignmentMeta>
): EventStaffAssignmentMeta {
  return {
    hourlyRate:
      patch.hourlyRate !== undefined ? patch.hourlyRate : (current?.hourlyRate ?? null),
    hours: patch.hours !== undefined ? patch.hours : (current?.hours ?? null),
    actualHours:
      patch.actualHours !== undefined
        ? patch.actualHours
        : (current?.actualHours ?? null),
    paidAt: patch.paidAt !== undefined ? patch.paidAt : (current?.paidAt ?? null),
    certificateSentAt:
      patch.certificateSentAt !== undefined
        ? patch.certificateSentAt
        : (current?.certificateSentAt ?? null),
    shiftId:
      patch.shiftId !== undefined ? patch.shiftId : (current?.shiftId ?? null),
    shiftLabel:
      patch.shiftLabel !== undefined
        ? patch.shiftLabel
        : (current?.shiftLabel ?? null),
    notes: patch.notes !== undefined ? patch.notes : (current?.notes ?? null),
  }
}

export const SERVICE_PARTICIPATION_STATUS_LABELS: Record<ServiceParticipationStatus, string> = {
  pending: "Pending approval",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
}
