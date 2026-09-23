export type VolunteerWindowSlot = {
  id: string
  name: string
  openings: number
}

export type VolunteerWindow = {
  id: string
  start: string
  end: string
  slots: VolunteerWindowSlot[]
}

export type VolunteerWindowFormSlot = {
  id: string
  name: string
  openings: string
}

export type VolunteerWindowFormRow = {
  id: string
  start: string
  end: string
  slots: VolunteerWindowFormSlot[]
}

type LegacyVolunteerRole = {
  name?: string | null
  slots?: number | null
  volunteerAllowed?: boolean | null
  shifts?: Array<{
    id?: string | null
    start?: string | null
    end?: string | null
  }> | null
}

type StoredVolunteers = {
  maxVolunteers?: number | null
  windows?: VolunteerWindow[] | null
  roles?: LegacyVolunteerRole[] | null
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function addHoursToTime(value: string, hours: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return ""
  const total = (Number(match[1]) * 60 + Number(match[2]) + hours * 60) % (24 * 60)
  const normalized = (total + 24 * 60) % (24 * 60)
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

/** One label per hour: "11 AM", "12 PM", "1 PM". Off-hour times keep minutes. */
export function formatVolunteerHourOption(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return ""
  if (match[2] !== "00") return formatClockLabel(value)
  let hour = Number(match[1])
  const suffix = hour >= 12 ? "PM" : "AM"
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour} ${suffix}`
}

/** 12 AM through 11 PM. Includes a saved off-hour time so it still appears. */
export function volunteerHourOptions(current?: string) {
  const options = Array.from({ length: 24 }, (_, hour) =>
    `${String(hour).padStart(2, "0")}:00`
  )
  const extra = current?.trim() || ""
  if (/^\d{2}:\d{2}$/.test(extra) && !options.includes(extra)) {
    options.push(extra)
    options.sort()
  }
  return options
}

export function formatClockLabel(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return ""
  let hour = Number(match[1])
  const minute = match[2]
  const suffix = hour >= 12 ? "PM" : "AM"
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour}:${minute} ${suffix}`
}

export function formatVolunteerWindowLabel(start: string, end: string) {
  const startLabel = formatClockLabel(start)
  const endLabel = formatClockLabel(end)
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`
  if (startLabel) return startLabel
  return "Time not set"
}

export function createEmptyVolunteerWindowSlot(partial?: {
  id?: string
  name?: string
  openings?: string
}): VolunteerWindowFormSlot {
  return {
    id: partial?.id || newId("slot"),
    name: partial?.name || "",
    openings: partial?.openings || "1",
  }
}

export function createEmptyVolunteerWindow(partial?: {
  id?: string
  start?: string
  end?: string
  slots?: VolunteerWindowFormSlot[]
}): VolunteerWindowFormRow {
  return {
    id: partial?.id || newId("win"),
    start: partial?.start || "",
    end: partial?.end || "",
    slots: partial?.slots ?? [createEmptyVolunteerWindowSlot()],
  }
}

/** Next block starts when the previous one ends, and lasts two hours. */
export function nextVolunteerWindowTimes(
  windows: Array<{ start: string; end: string }>
): { start: string; end: string } {
  const last = windows[windows.length - 1]
  const start = last?.end.trim()
    ? last.end.trim()
    : last?.start.trim()
      ? addHoursToTime(last.start, 2)
      : ""
  return {
    start,
    end: start ? addHoursToTime(start, 2) : "",
  }
}

function windowsFromLegacyRoles(roles: LegacyVolunteerRole[]): VolunteerWindowFormRow[] {
  const grouped = new Map<string, VolunteerWindowFormRow>()
  const order: string[] = []

  for (const role of roles) {
    if (role.volunteerAllowed === false) continue
    const name = (role.name || "").trim()
    if (!name) continue
    const openings = role.slots != null && role.slots > 0 ? String(role.slots) : "1"
    const shifts = (role.shifts || []).filter(
      (shift) => (shift.start || "").trim() || (shift.end || "").trim()
    )

    if (shifts.length === 0) {
      const key = "|"
      let window = grouped.get(key)
      if (!window) {
        window = createEmptyVolunteerWindow({
          id: "win-unscheduled",
          slots: [],
        })
        grouped.set(key, window)
        order.push(key)
      }
      window.slots.push(
        createEmptyVolunteerWindowSlot({ name, openings })
      )
      continue
    }

    for (const shift of shifts) {
      const start = (shift.start || "").trim()
      const end = (shift.end || "").trim()
      const key = `${start}|${end}`
      let window = grouped.get(key)
      if (!window) {
        window = createEmptyVolunteerWindow({
          id: `win-${key}`,
          start,
          end,
          slots: [],
        })
        grouped.set(key, window)
        order.push(key)
      }
      window.slots.push(
        createEmptyVolunteerWindowSlot({
          id: shift.id || undefined,
          name,
          openings,
        })
      )
    }
  }

  return order
    .map((key) => grouped.get(key))
    .filter((window): window is VolunteerWindowFormRow => Boolean(window))
}

export function volunteerWindowsFromStored(
  volunteers: StoredVolunteers | null | undefined
): VolunteerWindowFormRow[] {
  const stored = volunteers?.windows
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map((window) =>
      createEmptyVolunteerWindow({
        id: window.id,
        start: window.start || "",
        end: window.end || "",
        slots:
          window.slots?.length > 0
            ? window.slots.map((slot) =>
                createEmptyVolunteerWindowSlot({
                  id: slot.id,
                  name: slot.name || "",
                  openings:
                    slot.openings != null && slot.openings > 0
                      ? String(slot.openings)
                      : "1",
                })
              )
            : [createEmptyVolunteerWindowSlot()],
      })
    )
  }

  return windowsFromLegacyRoles(volunteers?.roles || [])
}

export function storedWindowsFromForm(
  windows: VolunteerWindowFormRow[]
): VolunteerWindow[] {
  return windows
    .map((window) => ({
      id: window.id,
      start: window.start.trim(),
      end: window.end.trim(),
      slots: window.slots
        .map((slot) => ({
          id: slot.id,
          name: slot.name.trim(),
          openings: Math.max(1, Number.parseInt(slot.openings, 10) || 1),
        }))
        .filter((slot) => slot.name.length > 0),
    }))
    .filter(
      (window) => window.start || window.end || window.slots.length > 0
    )
}

export function volunteerOpeningsFromConfig(
  volunteers: StoredVolunteers | null | undefined
): number | null {
  const windows = storedWindowsFromForm(volunteerWindowsFromStored(volunteers))
  const fromWindows = windows.reduce(
    (sum, window) =>
      sum + window.slots.reduce((slotSum, slot) => slotSum + slot.openings, 0),
    0
  )
  if (fromWindows > 0) return fromWindows

  const roles = (volunteers?.roles || []).filter(
    (role) => role.volunteerAllowed !== false && (role.name || "").trim()
  )
  const fromRoles = roles.reduce(
    (sum, role) => sum + Math.max(0, Number(role.slots) || 0),
    0
  )
  if (fromRoles > 0) return fromRoles

  const max = volunteers?.maxVolunteers
  if (typeof max === "number" && Number.isFinite(max) && max > 0) return max
  return null
}
