import { INTERNAL_EVENT_STATUSES } from "@/lib/events/internal-event-status"

export type EventOperationalPhase =
  | "draft"
  | "scheduled"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed"
  | "cancelled"

const PHASE_LABELS: Record<EventOperationalPhase, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export function getEventOperationalPhaseLabel(phase: EventOperationalPhase): string {
  return PHASE_LABELS[phase]
}

/** Derived operational phase for workspace display (independent of workflow status). */
export function getEventOperationalPhase(input: {
  status: string
  startAt: string | null
  endAt: string | null
  registrationEnabled: boolean
  salesOpenAt?: string | null
  salesCloseAt?: string | null
  now?: Date
}): EventOperationalPhase {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()

  if (
    input.status === INTERNAL_EVENT_STATUSES.cancelled ||
    input.status === INTERNAL_EVENT_STATUSES.declined
  ) {
    return "cancelled"
  }

  if (input.status === INTERNAL_EVENT_STATUSES.draft) {
    return "draft"
  }

  if (input.status === INTERNAL_EVENT_STATUSES.completed) {
    return "completed"
  }

  const startMs = input.startAt ? new Date(input.startAt).getTime() : null
  const endMs = input.endAt ? new Date(input.endAt).getTime() : null

  if (endMs != null && nowMs > endMs) {
    return "completed"
  }

  if (startMs != null && nowMs >= startMs && (endMs == null || nowMs <= endMs)) {
    return "in_progress"
  }

  if (input.registrationEnabled) {
    const salesOpenMs = input.salesOpenAt
      ? new Date(input.salesOpenAt).getTime()
      : null
    const salesCloseMs = input.salesCloseAt
      ? new Date(input.salesCloseAt).getTime()
      : null

    const salesStarted = salesOpenMs == null || nowMs >= salesOpenMs
    const salesEnded = salesCloseMs != null && nowMs > salesCloseMs

    if (salesStarted && !salesEnded) {
      return "registration_open"
    }

    if (salesEnded && (startMs == null || nowMs < startMs)) {
      return "registration_closed"
    }
  }

  return "scheduled"
}
