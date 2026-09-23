/**
 * Event Workspace feature toggles + tab visibility.
 * Stored on `internal_events.workspace_features` (JSONB) with fallbacks
 * from legacy `requires_*` flags so existing events keep working.
 */

export type EventAttendanceMode =
  | "paid"
  | "free"
  | "paid_and_free"
  | "open_public"

export type EventWorkspaceFeatures = {
  /** Registration offerings / tickets / free sign-up (not open-public-only). */
  registration: boolean
  staff: boolean
  youth: boolean
  vendors: boolean
  /** Explicit expense tracking UI; finance tab also appears when money exists. */
  finance: boolean
  waitlist: boolean
}

export const DEFAULT_WORKSPACE_FEATURES: EventWorkspaceFeatures = {
  registration: false,
  staff: false,
  youth: false,
  vendors: false,
  finance: false,
  waitlist: false,
}

export type EventWorkspaceTabId =
  | "overview"
  | "attendees"
  | "staff"
  | "volunteers"
  | "youth"
  | "vendors"
  | "finance"
  | "reports"
  | "settings"

export type EventSettingsSection = "general" | "tickets" | "features" | "checkout"

export type EventWorkspaceTabDef = {
  value: EventWorkspaceTabId
  label: string
}

const ALL_TABS: EventWorkspaceTabDef[] = [
  { value: "overview", label: "Overview" },
  { value: "attendees", label: "Orders" },
  { value: "staff", label: "Staff" },
  { value: "volunteers", label: "Volunteers" },
  { value: "youth", label: "Youth" },
  { value: "vendors", label: "Vendors" },
  { value: "finance", label: "Finance" },
  { value: "reports", label: "Reports" },
  { value: "settings", label: "Settings" },
]

export function parseEventWorkspaceFeatures(
  value: unknown
): Partial<EventWorkspaceFeatures> {
  if (!value || typeof value !== "object") return {}
  const row = value as Record<string, unknown>
  const out: Partial<EventWorkspaceFeatures> = {}
  for (const key of Object.keys(DEFAULT_WORKSPACE_FEATURES) as Array<
    keyof EventWorkspaceFeatures
  >) {
    if (typeof row[key] === "boolean") {
      out[key] = row[key] as boolean
    }
  }
  return out
}

export function parseAttendanceMode(value: unknown): EventAttendanceMode | null {
  if (
    value === "paid" ||
    value === "free" ||
    value === "paid_and_free" ||
    value === "open_public"
  ) {
    return value
  }
  return null
}

/** Resolve attendance mode from ticketing_config + legacy requires_ticketing. */
export function resolveAttendanceMode(input: {
  requires_ticketing?: boolean | null
  ticketing_config?: { attendanceMode?: unknown } | null
}): EventAttendanceMode {
  const fromConfig = parseAttendanceMode(input.ticketing_config?.attendanceMode)
  if (fromConfig) return fromConfig
  if (input.requires_ticketing === true) return "paid"
  return "open_public"
}

/** Merge stored features with legacy requires_* flags. */
export function resolveEventWorkspaceFeatures(input: {
  workspace_features?: unknown
  requires_ticketing?: boolean | null
  requires_volunteers?: boolean | null
  requires_childcare?: boolean | null
  requires_vendors?: boolean | null
  ticketing_config?: { attendanceMode?: unknown } | null
}): EventWorkspaceFeatures {
  const stored = parseEventWorkspaceFeatures(input.workspace_features)
  const mode = resolveAttendanceMode(input)
  const registrationFromMode = mode !== "open_public"

  return {
    registration:
      stored.registration ??
      (input.requires_ticketing === true || registrationFromMode),
    staff: stored.staff ?? false,
    youth: stored.youth ?? input.requires_childcare === true,
    vendors: stored.vendors ?? input.requires_vendors === true,
    finance: stored.finance ?? false,
    waitlist: stored.waitlist ?? false,
  }
}

export type WorkspaceVisibilityContext = {
  features: EventWorkspaceFeatures
  attendanceMode: EventAttendanceMode
  /** True when event has ticket revenue, expenses, or finance feature on. */
  hasFinancialActivity?: boolean
  /** True when there is at least one attendee seat. */
  hasAttendees?: boolean
  /** True when paid staff assignments exist. */
  hasStaffAssignments?: boolean
  /** True when this event is open for volunteer sign-ups. */
  needsVolunteers?: boolean
}

/** Progressive disclosure: which tabs appear in the workspace chrome. */
export function getVisibleWorkspaceTabs(
  ctx: WorkspaceVisibilityContext
): EventWorkspaceTabDef[] {
  const { features } = ctx
  const showStaff = features.staff || Boolean(ctx.hasStaffAssignments)
  const showVolunteers = Boolean(ctx.needsVolunteers)
  const showYouth = features.youth
  const showVendors = features.vendors
  const showFinance = features.finance || Boolean(ctx.hasFinancialActivity)
  const showReports = true

  return ALL_TABS.filter((tab) => {
    switch (tab.value) {
      case "overview":
      case "settings":
        return true
      case "attendees":
        return false
      case "staff":
        return showStaff
      case "volunteers":
        return showVolunteers
      case "youth":
        return showYouth
      case "vendors":
        return showVendors
      case "finance":
        return showFinance
      case "reports":
        return showReports
      default:
        return false
    }
  })
}

/** True when an old Tickets workspace URL should open Settings → Tickets. */
export function isLegacyTicketsTab(value: string | null | undefined): boolean {
  return value === "tickets" || value === "ticketing" || value === "registration"
}

/** Map URL ?section= values on the event Settings tab. */
export function parseEventSettingsSection(
  value: string | null | undefined
): EventSettingsSection {
  if (value === "features" || value === "modules" || value === "service-needs") {
    return "features"
  }
  if (isLegacyTicketsTab(value)) {
    return "tickets"
  }
  if (value === "checkout") {
    return "checkout"
  }
  return "general"
}

/** Map URL ?tab= values including legacy aliases. */
export function resolveWorkspaceTabId(
  value: string | null | undefined
): EventWorkspaceTabId | null {
  if (!value) return null
  if (isLegacyTicketsTab(value)) return "settings"
  if (value === "orders") return "attendees"
  if (value === "childcare") return "youth"
  if (ALL_TABS.some((tab) => tab.value === value)) {
    return value as EventWorkspaceTabId
  }
  return null
}

export type EventAttendancePickerMode = "paid" | "free"

/** Map stored/legacy modes onto the Paid / Free picker. */
export function toAttendancePickerMode(
  mode: EventAttendanceMode
): EventAttendancePickerMode {
  return mode === "free" || mode === "open_public" ? "free" : "paid"
}

export const ATTENDANCE_MODE_OPTIONS: Array<{
  value: EventAttendancePickerMode
  label: string
}> = [
  { value: "paid", label: "Paid" },
  { value: "free", label: "Free" },
]

export function attendanceModeRequiresOfferings(mode: EventAttendanceMode) {
  return mode === "paid" || mode === "free" || mode === "paid_and_free"
}

export function attendanceModeAllowsPaid(mode: EventAttendanceMode) {
  return mode === "paid" || mode === "paid_and_free"
}

export function attendanceModeAllowsFree(mode: EventAttendanceMode) {
  return mode === "free" || mode === "paid_and_free"
}
