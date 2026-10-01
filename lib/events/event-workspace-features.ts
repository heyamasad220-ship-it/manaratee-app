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
  /** Ticketing tab. Stored under this key for existing rows. */
  registration: boolean
  staff: boolean
  youth: boolean
  vendors: boolean
  /** Explicit expense tracking UI; finance tab also appears when money exists. */
  finance: boolean
  waitlist: boolean
  /** Plan tab: venue and transportation quotes. */
  plan: boolean
  /** Sponsors tab. */
  sponsors: boolean
  /** Volunteer openings on Sign-ups. */
  volunteers: boolean
  /** Childcare tab: age groups and child care providers. */
  childcare: boolean
}

export const DEFAULT_WORKSPACE_FEATURES: EventWorkspaceFeatures = {
  registration: false,
  staff: false,
  youth: false,
  vendors: false,
  finance: false,
  waitlist: false,
  plan: false,
  sponsors: false,
  volunteers: false,
  childcare: false,
}

export const EVENT_FEATURE_SWITCHES: Array<{
  key: keyof EventWorkspaceFeatures
  label: string
  description: string
}> = [
  {
    key: "volunteers",
    label: "Volunteers",
    description: "Sign-up openings for volunteers.",
  },
  {
    key: "childcare",
    label: "Childcare",
    description: "Age groups for this event. Providers already in the system sign up, and staff confirm them.",
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Vendor applications and assignments.",
  },
  {
    key: "sponsors",
    label: "Sponsors",
    description: "Sponsorship packages for this event.",
  },
  {
    key: "registration",
    label: "Ticketing",
    description: "Ticket types, orders, and check-in.",
  },
  {
    key: "plan",
    label: "Plan",
    description: "Venue and transportation quotes.",
  },
  {
    key: "staff",
    label: "Staff",
    description: "Paid staff for this event. Child care providers stay on the Childcare tab.",
  },
]

export type EventWorkspaceTabId =
  | "overview"
  | "plan"
  | "ticketing"
  | "attendees"
  | "staff"
  | "volunteers"
  | "childcare"
  | "youth"
  | "vendors"
  | "sponsors"
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
  { value: "plan", label: "Plan" },
  { value: "ticketing", label: "Ticketing" },
  { value: "attendees", label: "Orders" },
  { value: "staff", label: "Staff" },
  { value: "volunteers", label: "Sign-ups" },
  { value: "childcare", label: "Childcare" },
  { value: "vendors", label: "Vendors" },
  { value: "sponsors", label: "Sponsors" },
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

function storedFlag(
  stored: Partial<EventWorkspaceFeatures>,
  key: keyof EventWorkspaceFeatures,
  fallback: boolean
) {
  return typeof stored[key] === "boolean" ? Boolean(stored[key]) : fallback
}

/** Merge stored features with legacy requires_* flags. */
export function resolveEventWorkspaceFeatures(input: {
  workspace_features?: unknown
  requires_ticketing?: boolean | null
  requires_volunteers?: boolean | null
  requires_childcare?: boolean | null
  requires_vendors?: boolean | null
  ticketing_config?: { attendanceMode?: unknown } | null
  /** True when this event already has a planning quote. */
  hasPlanningQuote?: boolean
  /** True when this event has a sponsorship package or a linked campaign. */
  hasSponsors?: boolean
}): EventWorkspaceFeatures {
  const stored = parseEventWorkspaceFeatures(input.workspace_features)

  return {
    registration: storedFlag(stored, "registration", input.requires_ticketing === true),
    staff: storedFlag(stored, "staff", false),
    youth: stored.youth === true,
    vendors: storedFlag(stored, "vendors", input.requires_vendors === true),
    finance: storedFlag(stored, "finance", false),
    waitlist: storedFlag(stored, "waitlist", false),
    plan: storedFlag(stored, "plan", input.hasPlanningQuote === true),
    sponsors: storedFlag(stored, "sponsors", input.hasSponsors === true),
    volunteers: storedFlag(stored, "volunteers", input.requires_volunteers === true),
    childcare: storedFlag(stored, "childcare", input.requires_childcare === true),
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
  return ALL_TABS.filter((tab) => {
    switch (tab.value) {
      case "overview":
      case "settings":
      case "reports":
        return true
      case "plan":
        return features.plan
      case "ticketing":
        return features.registration
      case "sponsors":
        return features.sponsors
      case "attendees":
      case "finance":
      case "youth":
        return false
      case "staff":
        return showStaff
      case "volunteers":
        return features.volunteers || features.childcare
      case "childcare":
        return features.childcare
      case "vendors":
        return features.vendors
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
  if (value === "orders" || value === "attendees") return "ticketing"
  if (value === "finance") return "reports"
  if (isLegacyTicketsTab(value)) return "ticketing"
  if (value === "youth") return "overview"
  if (value === "sign-ups" || value === "signups") return "volunteers"
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
