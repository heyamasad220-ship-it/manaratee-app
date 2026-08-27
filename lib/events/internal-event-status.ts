export const INTERNAL_EVENT_STATUSES = {
  draft: "draft",
  submitted: "submitted",
  awaitingApproval: "awaiting_approval",
  approved: "approved",
  confirmed: "confirmed",
  scheduled: "scheduled",
  declined: "declined",
  cancelled: "cancelled",
  completed: "completed",
} as const

export type InternalEventStatus =
  (typeof INTERNAL_EVENT_STATUSES)[keyof typeof INTERNAL_EVENT_STATUSES]

export type InternalEventCalendarColor = "green" | "yellow" | "orange"

/** Simplified workspace visibility: Draft or Published. */
export type InternalEventWorkspaceStatus = "draft" | "published"

/** Compact event-workspace status menu. */
export type InternalEventStatusMenuValue =
  | "draft"
  | "pending"
  | "approved"
  | "completed"
  | "cancelled"

const STATUS_LABELS: Record<InternalEventStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
}

export function getInternalEventStatusLabel(status: InternalEventStatus | string): string {
  return STATUS_LABELS[status as InternalEventStatus] ?? status
}

/** Map any stored status to the Draft / Published workspace control. */
export function toWorkspaceEventStatus(
  status: InternalEventStatus | string
): InternalEventWorkspaceStatus {
  return status === INTERNAL_EVENT_STATUSES.draft ? "draft" : "published"
}

/** Persist workspace Draft/Published into a stored status value. */
export function fromWorkspaceEventStatus(
  workspaceStatus: InternalEventWorkspaceStatus
): InternalEventStatus {
  return workspaceStatus === "draft"
    ? INTERNAL_EVENT_STATUSES.draft
    : INTERNAL_EVENT_STATUSES.approved
}

export function getInternalEventWorkspaceStatusLabel(
  status: InternalEventStatus | string
): string {
  return toWorkspaceEventStatus(status) === "draft" ? "Draft" : "Published"
}

export function getInternalEventStatusOptions(includeWorkflow = true) {
  if (!includeWorkflow) {
    return [
      { value: "draft" as const, label: "Draft" },
      { value: "published" as const, label: "Published" },
    ]
  }

  return Object.values(INTERNAL_EVENT_STATUSES).map((status) => ({
    value: status,
    label: getInternalEventStatusLabel(status),
  }))
}

/** Options for event workspace: Draft | Published only. */
export function getInternalEventWorkspaceStatusOptions() {
  return getInternalEventStatusOptions(false)
}

const STATUS_MENU_LABELS: Record<InternalEventStatusMenuValue, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
}

export function toInternalEventStatusMenuValue(
  status: InternalEventStatus | string
): InternalEventStatusMenuValue {
  if (status === INTERNAL_EVENT_STATUSES.draft) return "draft"
  if (
    status === INTERNAL_EVENT_STATUSES.submitted ||
    status === INTERNAL_EVENT_STATUSES.awaitingApproval
  ) {
    return "pending"
  }
  if (status === INTERNAL_EVENT_STATUSES.completed) return "completed"
  if (
    status === INTERNAL_EVENT_STATUSES.cancelled ||
    status === INTERNAL_EVENT_STATUSES.declined
  ) {
    return "cancelled"
  }
  return "approved"
}

export function fromInternalEventStatusMenuValue(
  value: InternalEventStatusMenuValue
): InternalEventStatus {
  if (value === "draft") return INTERNAL_EVENT_STATUSES.draft
  if (value === "pending") return INTERNAL_EVENT_STATUSES.awaitingApproval
  if (value === "completed") return INTERNAL_EVENT_STATUSES.completed
  if (value === "cancelled") return INTERNAL_EVENT_STATUSES.cancelled
  return INTERNAL_EVENT_STATUSES.confirmed
}

export function getInternalEventStatusMenuLabel(
  status: InternalEventStatus | string
): string {
  return STATUS_MENU_LABELS[toInternalEventStatusMenuValue(status)]
}

export function getInternalEventStatusMenuOptions() {
  return (Object.keys(STATUS_MENU_LABELS) as InternalEventStatusMenuValue[]).map(
    (value) => ({
      value,
      label: STATUS_MENU_LABELS[value],
    })
  )
}

export function isInternalEventPendingApproval(status: string): boolean {
  return (
    status === INTERNAL_EVENT_STATUSES.submitted ||
    status === INTERNAL_EVENT_STATUSES.awaitingApproval
  )
}

export function isInternalEventTerminal(status: string): boolean {
  return (
    status === INTERNAL_EVENT_STATUSES.declined ||
    status === INTERNAL_EVENT_STATUSES.cancelled ||
    status === INTERNAL_EVENT_STATUSES.completed
  )
}

export function getInternalEventCalendarColor(status: string): InternalEventCalendarColor {
  switch (status) {
    case INTERNAL_EVENT_STATUSES.confirmed:
    case INTERNAL_EVENT_STATUSES.approved:
    case INTERNAL_EVENT_STATUSES.scheduled:
    case INTERNAL_EVENT_STATUSES.completed:
      return "green"
    case INTERNAL_EVENT_STATUSES.declined:
    case INTERNAL_EVENT_STATUSES.cancelled:
      return "orange"
    default:
      return "yellow"
  }
}

export function mapInternalEventStatusToReservationStatus(
  status: InternalEventStatus | string
): string | null {
  if (
    status === INTERNAL_EVENT_STATUSES.cancelled ||
    status === INTERNAL_EVENT_STATUSES.declined ||
    status === INTERNAL_EVENT_STATUSES.draft
  ) {
    return null
  }

  if (
    status === INTERNAL_EVENT_STATUSES.submitted ||
    status === INTERNAL_EVENT_STATUSES.awaitingApproval
  ) {
    return "temporary_hold"
  }

  if (
    status === INTERNAL_EVENT_STATUSES.approved ||
    status === INTERNAL_EVENT_STATUSES.confirmed ||
    status === INTERNAL_EVENT_STATUSES.scheduled ||
    status === INTERNAL_EVENT_STATUSES.completed
  ) {
    return "confirmed"
  }

  return "temporary_hold"
}
