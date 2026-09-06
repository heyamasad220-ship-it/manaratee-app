export const EVENT_MANAGEMENT_EVENTS_COLUMN_IDS = [
  "event",
  "department",
  "date",
  "time",
  "location",
  "space",
  "status",
  "category",
  "issued",
  "remaining",
  "revenue",
  "actions",
] as const

export type EventManagementEventsColumnId =
  (typeof EVENT_MANAGEMENT_EVENTS_COLUMN_IDS)[number]

export type EventManagementEventsColumnDefinition = {
  id: EventManagementEventsColumnId
  label: string
  defaultVisible: boolean
}

export const EVENT_MANAGEMENT_EVENTS_COLUMN_DEFINITIONS: EventManagementEventsColumnDefinition[] =
  [
    { id: "event", label: "Event", defaultVisible: true },
    { id: "department", label: "Department", defaultVisible: true },
    { id: "date", label: "Date", defaultVisible: true },
    { id: "time", label: "Time", defaultVisible: true },
    { id: "location", label: "Location", defaultVisible: true },
    { id: "space", label: "Space", defaultVisible: true },
    { id: "status", label: "Status", defaultVisible: true },
    { id: "category", label: "Category", defaultVisible: true },
    { id: "issued", label: "Issued", defaultVisible: true },
    { id: "remaining", label: "Remaining", defaultVisible: true },
    { id: "revenue", label: "Revenue", defaultVisible: true },
    { id: "actions", label: "Actions", defaultVisible: true },
  ]

export const DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS: EventManagementEventsColumnId[] =
  EVENT_MANAGEMENT_EVENTS_COLUMN_DEFINITIONS.filter(
    (column) => column.defaultVisible
  ).map((column) => column.id)

export const LOCKED_EVENT_MANAGEMENT_EVENTS_COLUMNS: EventManagementEventsColumnId[] =
  ["event"]

export const EVENT_MANAGEMENT_EVENTS_COLUMNS_STORAGE_KEY =
  "manaratee:event-management-events-columns:v1"

function isColumnId(value: string): value is EventManagementEventsColumnId {
  return (EVENT_MANAGEMENT_EVENTS_COLUMN_IDS as readonly string[]).includes(
    value
  )
}

export function normalizeEventManagementEventsColumns(
  value: unknown,
  options?: { canManage?: boolean }
): EventManagementEventsColumnId[] {
  const canManage = options?.canManage !== false
  if (!Array.isArray(value)) {
    return DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS.filter(
      (id) => canManage || id !== "actions"
    )
  }

  const selected = new Set(
    value.filter(
      (item): item is EventManagementEventsColumnId =>
        typeof item === "string" && isColumnId(item)
    )
  )
  if (selected.size === 0) {
    return DEFAULT_EVENT_MANAGEMENT_EVENTS_COLUMNS.filter(
      (id) => canManage || id !== "actions"
    )
  }
  for (const locked of LOCKED_EVENT_MANAGEMENT_EVENTS_COLUMNS) {
    selected.add(locked)
  }
  if (!canManage) selected.delete("actions")
  return EVENT_MANAGEMENT_EVENTS_COLUMN_IDS.filter((id) => selected.has(id))
}

export function toggleEventManagementEventsColumn(
  current: EventManagementEventsColumnId[],
  id: EventManagementEventsColumnId,
  visible: boolean,
  options?: { canManage?: boolean }
): EventManagementEventsColumnId[] {
  if (!visible && LOCKED_EVENT_MANAGEMENT_EVENTS_COLUMNS.includes(id)) {
    return normalizeEventManagementEventsColumns(current, options)
  }
  const selected = new Set(normalizeEventManagementEventsColumns(current, options))
  if (visible) selected.add(id)
  else selected.delete(id)
  return normalizeEventManagementEventsColumns([...selected], options)
}

export function loadEventManagementEventsColumns(options?: {
  canManage?: boolean
}): EventManagementEventsColumnId[] {
  if (typeof window === "undefined") {
    return normalizeEventManagementEventsColumns(null, options)
  }
  try {
    const raw = window.localStorage.getItem(
      EVENT_MANAGEMENT_EVENTS_COLUMNS_STORAGE_KEY
    )
    if (!raw) return normalizeEventManagementEventsColumns(null, options)
    return normalizeEventManagementEventsColumns(JSON.parse(raw), options)
  } catch {
    return normalizeEventManagementEventsColumns(null, options)
  }
}

export function saveEventManagementEventsColumns(
  columns: EventManagementEventsColumnId[]
) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      EVENT_MANAGEMENT_EVENTS_COLUMNS_STORAGE_KEY,
      JSON.stringify(normalizeEventManagementEventsColumns(columns))
    )
  } catch {
    // Ignore quota / private mode
  }
}
