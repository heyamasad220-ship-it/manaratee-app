/**
 * Import Google Form InternalEvents.xlsx → Event Management (internal_events).
 *
 * Rules (September 2026):
 * - One-time events only (recurring programs skipped)
 * - Skip Department = Other
 * - Map Center Programs → Center, Quran Institute → Quran Institute for Ladies
 * - Create missing departments: CYP, Scouts, Dawah Outreach
 * - Create missing facility rooms; multi-select spaces become multiple venues
 * - Requesters → Directory contacts + coordinator_contact_id (no staff logins)
 * - Past end → completed, future → confirmed (Live); not published to Community Calendar
 * - Overnight when end clock is at or before start (e.g. 10 PM–6 AM)
 *
 * Usage (dry-run by default):
 *   node scripts/import-internal-events-xlsx.mjs
 *   node scripts/import-internal-events-xlsx.mjs --xlsx "C:/Users/danan/Downloads/InternalEvents.xlsx"
 *   node scripts/import-internal-events-xlsx.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "INTERNAL_EVENTS_XLSX_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_XLSX = "C:/Users/danan/Downloads/InternalEvents.xlsx"
const TZ = "America/Chicago"

const COL = {
  timestamp: "Timestamp",
  email: "Email Address",
  fullName: "Full Name",
  phone: "Phone Number",
  department: "Department",
  eventName: "Name of Event",
  description:
    "Please describe program/ Event and activities including purpose/ objectives.",
  space: "Requested Space/ Room",
  attendance: "How many people are you expecting?",
  setup: "Room Setup Needed",
  food: "Food & Beverages",
  linens: "Table Covers",
  equipment: "Equipment & Support",
  special: "Any other special requests or accomodations?",
  childcare: "Will Babysitting/Childcare be needed?",
  childrenCount: "Estimated Number of Children",
  childrenAges: "Age Group(s) of Children",
  frequency: "Program Frequency & Schedule",
  eventDate: "Event Date",
  startTime: "Event Start Time",
  endTime: "Event End Time",
  admission: "Will you be charging admission fees?",
  vendors: "Will purchases/ vendors be involved?",
}

const DEPARTMENT_MAP = {
  youth: "Youth",
  education: "Education",
  tarbiya: "Tarbiya",
  cyp: "CYP",
  "center programs": "Center",
  center: "Center",
  scouts: "Scouts",
  "dawah outreach": "Dawah Outreach",
  "quran institute": "Quran Institute for Ladies",
  rsa: "Rising Star Academy (RSA)",
}

const NEW_DEPARTMENT_COLORS = {
  CYP: "#db2777",
  Scouts: "#15803d",
  "Dawah Outreach": "#0369a1",
}

const NEW_VENUE_COLORS = {
  "Main Lobby": "#94a3b8",
  "Conference room (2nd floor - main building)": "#6366f1",
  "New Youth Lounge (2nd floor - main building)": "#f59e0b",
  Pool: "#06b6d4",
  "Pool Room (1st floor - main building)": "#0ea5e9",
  "Open space between the 2 buildings": "#84cc16",
}

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function parseArgs(argv) {
  const args = {
    xlsx: DEFAULT_XLSX,
    execute: false,
    orgId: DEFAULT_ORG_ID,
    limit: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--xlsx") args.xlsx = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
    else if (arg === "--limit") args.limit = Number(argv[++i])
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function cell(row, key) {
  return row[key] ?? null
}

function isYes(value) {
  return /^yes$/i.test(normalizeText(value))
}

function parseSheetDate(value) {
  if (value == null || value === "") return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const d = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  const raw = normalizeText(value)
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(raw)
  if (slash) {
    let year = Number(slash[3])
    if (year < 100) year += 2000
    return `${year}-${String(slash[1]).padStart(2, "0")}-${String(slash[2]).padStart(2, "0")}`
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return null
}

function parseSheetTime(value) {
  if (value == null || value === "") return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const h = String(value.getHours()).padStart(2, "0")
    const m = String(value.getMinutes()).padStart(2, "0")
    const s = String(value.getSeconds()).padStart(2, "0")
    return `${h}:${m}:${s}`
  }
  const raw = normalizeText(value)
  const ampm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(raw)
  if (ampm) {
    let hour = Number(ampm[1])
    const minute = ampm[2]
    const second = ampm[3] || "00"
    const meridiem = ampm[4].toUpperCase()
    if (meridiem === "AM") {
      if (hour === 12) hour = 0
    } else if (hour !== 12) {
      hour += 12
    }
    return `${String(hour).padStart(2, "0")}:${minute}:${second}`
  }
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  if (/^\d{2}:\d{2}:\d{2}/.test(raw)) return raw.slice(0, 8)
  return null
}

function timeZoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)
  const value = {}
  for (const part of parts) {
    if (part.type !== "literal") value[part.type] = part.value
  }
  const asUtcFromWall = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second)
  )
  return asUtcFromWall - instant.getTime()
}

function wallTimeToIso(date, time, timeZone = TZ) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const clock = time && /^\d{2}:\d{2}:\d{2}$/.test(time) ? time : "12:00:00"
  const naiveUtc = new Date(`${date}T${clock}Z`)
  if (Number.isNaN(naiveUtc.getTime())) return null
  const first = new Date(naiveUtc.getTime() - timeZoneOffsetMs(naiveUtc, timeZone))
  const adjusted = new Date(naiveUtc.getTime() - timeZoneOffsetMs(first, timeZone))
  return adjusted.toISOString()
}

function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`
}

function clockToMinutes(clock) {
  const [h, m] = clock.split(":").map(Number)
  return h * 60 + m
}

function parseAttendance(value) {
  if (value == null || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value)
  }
  const raw = normalizeText(value)
  const excelDate = /^(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i.exec(
    raw
  )
  if (excelDate) {
    const day = Number(excelDate[1])
    const month = MONTHS[excelDate[2].toLowerCase()]
    return Math.max(day, month)
  }
  const plus = /^(\d+)\+$/.exec(raw)
  if (plus) return Number(plus[1])
  const slash = /^(\d+)\s*[\/]\s*(\d+)$/.exec(raw)
  if (slash) return Math.max(Number(slash[1]), Number(slash[2]))
  const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(raw)
  if (range) return Math.max(Number(range[1]), Number(range[2]))
  const single = /^(\d+)$/.exec(raw)
  if (single) return Number(single[1])
  const first = /(\d+)/.exec(raw)
  return first ? Number(first[1]) : null
}

function parseChildrenCount(value) {
  return parseAttendance(value)
}

function importKey(row) {
  const stamp = normalizeText(cell(row, COL.timestamp))
  const email = normalizeText(cell(row, COL.email)).toLowerCase()
  const name = normalizeText(cell(row, COL.eventName)).toLowerCase()
  const date = parseSheetDate(cell(row, COL.eventDate)) || ""
  return createHash("sha1")
    .update(`${stamp}|${email}|${name}|${date}`)
    .digest("hex")
    .slice(0, 16)
}

function mapDepartmentName(raw) {
  const key = normalizeText(raw).toLowerCase()
  if (key === "other") return { skip: true, reason: "other_department" }
  const mapped = DEPARTMENT_MAP[key]
  if (!mapped) {
    return { skip: true, reason: "unknown_department", raw }
  }
  return { skip: false, name: mapped, source: normalizeText(raw) }
}

function mapSpaceToken(raw) {
  const original = normalizeText(raw)
  if (!original) return null
  const t = original.toLowerCase()
  if (
    t.includes("either of the rooms") ||
    t.includes("one of them") ||
    t.includes("room for childcare")
  ) {
    return { kind: "note", text: original }
  }
  if (t.includes("ooennspace") || t.includes("open space") || t.includes("between the 2 buildings")) {
    return { kind: "venue", name: "Open space between the 2 buildings" }
  }
  if (t.includes("new youth lounge")) {
    return { kind: "venue", name: "New Youth Lounge (2nd floor - main building)" }
  }
  if (t.includes("youth lounge")) {
    return { kind: "venue", name: "Youth Lounge" }
  }
  if (t.includes("banquet")) {
    return { kind: "venue", name: "Banquet Hall" }
  }
  if (t.includes("main prayer") || t === "mph") {
    return { kind: "venue", name: "Main Prayer Hall (MPH)" }
  }
  if (t.includes("main lobby") || t === "lobby") {
    return { kind: "venue", name: "Main Lobby" }
  }
  if (t.includes("conference")) {
    return { kind: "venue", name: "Conference room (2nd floor - main building)" }
  }
  if (t.includes("pool room")) {
    return { kind: "venue", name: "Pool Room (1st floor - main building)" }
  }
  if (t === "pool" || t.startsWith("pool")) {
    return { kind: "venue", name: "Pool" }
  }
  return { kind: "venue", name: original }
}

function parseSpaces(raw) {
  const text = normalizeText(raw)
  if (!text) return { venueNames: [], notes: [] }
  const tokens = text.split(",").map((part) => part.trim()).filter(Boolean)
  const venueNames = []
  const notes = []
  for (const token of tokens) {
    const mapped = mapSpaceToken(token)
    if (!mapped) continue
    if (mapped.kind === "note") {
      notes.push(mapped.text)
      continue
    }
    if (!venueNames.includes(mapped.name)) venueNames.push(mapped.name)
  }
  return { venueNames, notes, raw: text }
}

function pickEventTypeName(eventName) {
  const n = eventName.toLowerCase()
  if (/\bmeeting\b|\bbor\b|board of review/.test(n)) return "Meeting"
  if (/workshop|training|\bpd\b|orientation/.test(n)) return "Workshop"
  if (/quran|hifdth|hifz|dawah|سيرة/.test(n)) return "Religious Program"
  if (/dinner|fundrais/.test(n)) return "Fundraiser"
  return "Community Event"
}

function eventStatus(endAt, startAt) {
  const now = Date.now()
  const endMs = endAt ? new Date(endAt).getTime() : NaN
  const startMs = startAt ? new Date(startAt).getTime() : NaN
  if (Number.isFinite(endMs) && endMs < now) return "completed"
  if (Number.isFinite(startMs) && startMs < now) return "completed"
  return "confirmed"
}

function buildInternalNotes(row, key, extras) {
  const lines = [
    "Imported from Internal Events Google Form.",
    `Requester: ${normalizeText(cell(row, COL.fullName))}`,
    `Email: ${normalizeText(cell(row, COL.email))}`,
    `Phone: ${normalizeText(cell(row, COL.phone))}`,
    `Form department: ${normalizeText(cell(row, COL.department))}`,
  ]
  if (extras.spaceRaw) lines.push(`Requested space: ${extras.spaceRaw}`)
  if (extras.spaceNotes.length) {
    lines.push(`Space notes: ${extras.spaceNotes.join("; ")}`)
  }
  if (extras.overnight) lines.push("Overnight: end time is on the next calendar day.")
  lines.push(`${IMPORT_TAG}:${key}`)
  return lines.join("\n")
}

function loadRows(xlsxPath) {
  if (!existsSync(xlsxPath)) {
    throw new Error(`Spreadsheet not found: ${xlsxPath}`)
  }
  const workbook = XLSX.read(readFileSync(xlsxPath), {
    type: "buffer",
    cellDates: true,
  })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })
}

function planFromSpreadsheet(rows) {
  const skipped = []
  const planned = []
  for (const row of rows) {
    const frequency = normalizeText(cell(row, COL.frequency))
    const eventName = normalizeText(cell(row, COL.eventName))
    if (!eventName) {
      skipped.push({ reason: "missing_name", eventName })
      continue
    }
    if (!frequency.toLowerCase().includes("one-time")) {
      skipped.push({
        reason: "recurring",
        eventName,
        department: normalizeText(cell(row, COL.department)),
      })
      continue
    }
    const department = mapDepartmentName(cell(row, COL.department))
    if (department.skip) {
      skipped.push({
        reason: department.reason,
        eventName,
        department: department.raw || normalizeText(cell(row, COL.department)),
      })
      continue
    }

    const dateKey = parseSheetDate(cell(row, COL.eventDate))
    const startClock = parseSheetTime(cell(row, COL.startTime))
    let endClock = parseSheetTime(cell(row, COL.endTime))
    if (!dateKey || !startClock) {
      skipped.push({
        reason: "missing_datetime",
        eventName,
        date: dateKey,
        startClock,
        endClock,
      })
      continue
    }
    if (!endClock) {
      const [h, m, s] = startClock.split(":").map(Number)
      const plus = (h + 2) % 24
      endClock = `${String(plus).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    }

    const overnight = clockToMinutes(endClock) <= clockToMinutes(startClock)
    const endDateKey = overnight ? addDays(dateKey, 1) : dateKey
    const startAt = wallTimeToIso(dateKey, startClock)
    const endAt = wallTimeToIso(endDateKey, endClock)
    const spaces = parseSpaces(cell(row, COL.space))
    const key = importKey(row)
    const requiresChildcare = isYes(cell(row, COL.childcare))
    const requiresTicketing = isYes(cell(row, COL.admission))
    const requiresVendors = isYes(cell(row, COL.vendors))
    const estimatedAttendance = parseAttendance(cell(row, COL.attendance))
    const childrenCount = parseChildrenCount(cell(row, COL.childrenCount))
    const ageGroups = normalizeText(cell(row, COL.childrenAges))

    planned.push({
      importKey: key,
      eventName,
      departmentName: department.name,
      formDepartment: department.source,
      eventTypeName: pickEventTypeName(eventName),
      description: normalizeText(cell(row, COL.description)) || null,
      dateKey,
      startClock,
      endClock,
      endDateKey,
      overnight,
      startAt,
      endAt,
      status: eventStatus(endAt, startAt),
      venueNames: spaces.venueNames,
      spaceRaw: spaces.raw || "",
      spaceNotes: spaces.notes,
      locationLabel: spaces.venueNames[0] || spaces.raw || null,
      requesterName: normalizeText(cell(row, COL.fullName)),
      requesterEmail: normalizeText(cell(row, COL.email)).toLowerCase(),
      requesterPhone: normalizeText(cell(row, COL.phone)),
      estimatedAttendance,
      attendanceRaw: normalizeText(cell(row, COL.attendance)),
      requiresChildcare,
      requiresTicketing,
      requiresVendors,
      childrenCount,
      ageGroups,
      setupStyle: normalizeText(cell(row, COL.setup)) || null,
      foodNotes: normalizeText(cell(row, COL.food)) || null,
      linenNotes: normalizeText(cell(row, COL.linens)) || null,
      equipmentNotes: normalizeText(cell(row, COL.equipment)) || null,
      specialRequests: normalizeText(cell(row, COL.special)) || null,
      internalNotes: buildInternalNotes(row, key, {
        spaceRaw: spaces.raw || "",
        spaceNotes: spaces.notes,
        overnight,
      }),
    })
  }
  return { planned, skipped }
}

async function loadCatalog(sb, orgId) {
  const [{ data: departments, error: deptError }, { data: venues, error: venueError }, { data: eventTypes, error: typeError }, { data: existingEvents, error: eventError }] =
    await Promise.all([
      sb.from("departments").select("id, name").eq("organization_id", orgId),
      sb.from("venues").select("id, name").eq("organization_id", orgId),
      sb.from("event_types").select("id, name").eq("organization_id", orgId).eq("is_active", true),
      sb
        .from("internal_events")
        .select("id, name, internal_notes")
        .eq("organization_id", orgId)
        .ilike("internal_notes", `%${IMPORT_TAG}:%`),
    ])
  if (deptError) throw new Error(deptError.message)
  if (venueError) throw new Error(venueError.message)
  if (typeError) throw new Error(typeError.message)
  if (eventError) throw new Error(eventError.message)

  const importedKeys = new Set()
  for (const event of existingEvents || []) {
    const match = String(event.internal_notes || "").match(
      new RegExp(`${IMPORT_TAG}:([a-f0-9]{16})`)
    )
    if (match) importedKeys.add(match[1])
  }

  return {
    departments: departments || [],
    venues: venues || [],
    eventTypes: eventTypes || [],
    importedKeys,
  }
}

function byLowerName(rows) {
  const map = new Map()
  for (const row of rows) {
    map.set(String(row.name || "").trim().toLowerCase(), row)
  }
  return map
}

async function ensureDepartment(sb, orgId, name, cache) {
  const key = name.toLowerCase()
  if (cache.has(key)) return { row: cache.get(key), created: false }
  const { data, error } = await sb
    .from("departments")
    .insert({
      organization_id: orgId,
      name,
      color: NEW_DEPARTMENT_COLORS[name] || "#3b82f6",
    })
    .select("id, name")
    .single()
  if (error) throw new Error(`Department ${name}: ${error.message}`)
  cache.set(key, data)
  return { row: data, created: true }
}

async function ensureVenue(sb, orgId, name, cache) {
  const key = name.toLowerCase()
  if (cache.has(key)) return { row: cache.get(key), created: false }
  const { data, error } = await sb
    .from("venues")
    .insert({
      organization_id: orgId,
      name,
      status: "active",
      usage_tag: "internal",
      available_for_bookings: false,
      color: NEW_VENUE_COLORS[name] || "#3b82f6",
      capacity: 0,
      base_price: 0,
      hourly_rate: 0,
      peak_flat_price: 0,
      peak_hourly_rate: 0,
    })
    .select("id, name")
    .single()
  if (error) throw new Error(`Venue ${name}: ${error.message}`)
  cache.set(key, data)
  return { row: data, created: true }
}

async function ensureContact(sb, orgId, person) {
  const { data, error } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: orgId,
    p_full_name: person.name || "Unknown",
    p_email: person.email || null,
    p_phone: person.phone || null,
    p_contact_type: "individual",
  })
  if (!error && data) return data
  const { data: created, error: insertError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: person.name || "Unknown",
      email: person.email || null,
      phone: person.phone || null,
      contact_type: "individual",
      status: "active",
    })
    .select("id")
    .single()
  if (insertError) throw new Error(`Contact ${person.email}: ${insertError.message}`)
  return created.id
}

function isoDateOnly(iso) {
  return iso ? iso.slice(0, 10) : null
}

function isoTimeOnly(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(11, 19)
}

async function upsertOperationalBrief(sb, orgId, event, contactId) {
  const payload = {
    organization_id: orgId,
    source_type: "internal_event",
    source_id: event.id,
    title: event.eventName,
    event_date: isoDateOnly(event.startAt),
    start_time: isoTimeOnly(event.startAt),
    end_time: isoTimeOnly(event.endAt),
    primary_contact_person_id: contactId,
    primary_contact_name: event.requesterName || null,
    primary_contact_phone: event.requesterPhone || null,
    internal_coordinator_person_id: contactId,
    internal_coordinator_name: event.requesterName || null,
    internal_coordinator_phone: event.requesterPhone || null,
    internal_coordinator_email: event.requesterEmail || null,
    expected_attendance: event.estimatedAttendance,
    setup_style: event.setupStyle,
    room_setup_notes: event.setupStyle,
    equipment_notes: event.equipmentNotes,
    food_beverage_notes: event.foodNotes,
    table_linen_notes: event.linenNotes,
    special_requests: event.specialRequests,
    facility_notes: event.spaceRaw
      ? `Requested space: ${event.spaceRaw}`
      : null,
    source_status: event.status,
    setup_status: event.status === "completed" ? "closed" : "ready_for_setup",
    visibility_level: "staff",
  }

  const { data: existing } = await sb
    .from("operational_briefs")
    .select("id")
    .eq("organization_id", orgId)
    .eq("source_type", "internal_event")
    .eq("source_id", event.id)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await sb
      .from("operational_briefs")
      .update(payload)
      .eq("id", existing.id)
    if (error) throw new Error(`Brief update ${event.eventName}: ${error.message}`)
    return
  }

  const { error } = await sb.from("operational_briefs").insert(payload)
  if (error) throw new Error(`Brief insert ${event.eventName}: ${error.message}`)
}

function writeReport(kind, payload) {
  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, `internal-events-xlsx-import-${kind}.json`)
  writeFileSync(path, JSON.stringify(payload, null, 2))
  return path
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const rows = loadRows(args.xlsx)
  const { planned, skipped } = planFromSpreadsheet(rows)
  const limited = args.limit ? planned.slice(0, args.limit) : planned

  const departmentsNeeded = [...new Set(limited.map((row) => row.departmentName))]
  const venuesNeeded = [...new Set(limited.flatMap((row) => row.venueNames))]
  const peopleNeeded = [
    ...new Map(
      limited.map((row) => [
        row.requesterEmail || row.requesterName,
        {
          name: row.requesterName,
          email: row.requesterEmail,
          phone: row.requesterPhone,
        },
      ])
    ).values(),
  ]

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const catalog = await loadCatalog(sb, args.orgId)
  const deptCache = byLowerName(catalog.departments)
  const venueCache = byLowerName(catalog.venues)
  const typeCache = byLowerName(catalog.eventTypes)

  const alreadyImported = limited.filter((row) =>
    catalog.importedKeys.has(row.importKey)
  )
  const toInsert = limited.filter((row) => !catalog.importedKeys.has(row.importKey))

  const missingDepartments = departmentsNeeded.filter(
    (name) => !deptCache.has(name.toLowerCase())
  )
  const missingVenues = venuesNeeded.filter(
    (name) => !venueCache.has(name.toLowerCase())
  )

  const report = {
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    source: args.xlsx,
    spreadsheetRows: rows.length,
    planned: limited.length,
    skipped: skipped.length,
    skippedBreakdown: skipped.reduce((acc, row) => {
      acc[row.reason] = (acc[row.reason] || 0) + 1
      return acc
    }, {}),
    alreadyImported: alreadyImported.length,
    toInsert: toInsert.length,
    departmentsNeeded,
    missingDepartments,
    venuesNeeded,
    missingVenues,
    peopleCount: peopleNeeded.length,
    overnight: toInsert.filter((row) => row.overnight).map((row) => row.eventName),
    events: toInsert.map((row) => ({
      name: row.eventName,
      department: row.departmentName,
      type: row.eventTypeName,
      start: row.startAt,
      end: row.endAt,
      overnight: row.overnight,
      status: row.status,
      venues: row.venueNames,
      coordinator: `${row.requesterName} <${row.requesterEmail}>`,
      childcare: row.requiresChildcare,
      ticketing: row.requiresTicketing,
      vendors: row.requiresVendors,
      attendance: row.estimatedAttendance,
    })),
    skippedSample: skipped.slice(0, 30),
  }

  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        planned: report.planned,
        skipped: report.skipped,
        skippedBreakdown: report.skippedBreakdown,
        alreadyImported: report.alreadyImported,
        toInsert: report.toInsert,
        missingDepartments: report.missingDepartments,
        missingVenues: report.missingVenues,
        peopleCount: report.peopleCount,
        overnight: report.overnight,
      },
      null,
      2
    )
  )

  if (!args.execute) {
    const path = writeReport("dry-run", report)
    console.log(`Dry-run report: ${path}`)
    return
  }

  const created = {
    departments: [],
    venues: [],
    events: [],
    contacts: 0,
  }

  for (const name of missingDepartments) {
    const result = await ensureDepartment(sb, args.orgId, name, deptCache)
    if (result.created) created.departments.push(name)
  }
  for (const name of missingVenues) {
    const result = await ensureVenue(sb, args.orgId, name, venueCache)
    if (result.created) created.venues.push(name)
  }

  const contactIds = new Map()
  for (const person of peopleNeeded) {
    const id = await ensureContact(sb, args.orgId, person)
    contactIds.set(person.email || person.name, id)
    created.contacts += 1
  }

  for (const event of toInsert) {
    const department = deptCache.get(event.departmentName.toLowerCase())
    const eventType = typeCache.get(event.eventTypeName.toLowerCase())
    if (!department) throw new Error(`Missing department ${event.departmentName}`)
    if (!eventType) throw new Error(`Missing event type ${event.eventTypeName}`)
    const venueIds = event.venueNames.map((name) => {
      const venue = venueCache.get(name.toLowerCase())
      if (!venue) throw new Error(`Missing venue ${name}`)
      return venue.id
    })
    const contactId = contactIds.get(event.requesterEmail || event.requesterName) || null
    const serviceRequirements = event.requiresChildcare
      ? {
          childcare: {
            capacity: event.childrenCount,
            ageRange: event.ageGroups || null,
          },
        }
      : {}

    const { data, error } = await sb
      .from("internal_events")
      .insert({
        organization_id: args.orgId,
        department_id: department.id,
        event_type_id: eventType.id,
        name: event.eventName,
        description: event.description,
        status: event.status,
        start_at: event.startAt,
        end_at: event.endAt,
        timezone: TZ,
        location_type: "facility",
        location_label: event.locationLabel,
        venue_id: venueIds[0] || null,
        coordinator_contact_id: contactId,
        estimated_attendance: event.estimatedAttendance,
        requires_childcare: event.requiresChildcare,
        requires_vendors: event.requiresVendors,
        requires_ticketing: event.requiresTicketing,
        requires_volunteers: false,
        community_calendar_status: "not_published",
        workspace_features: {
          registration: event.requiresTicketing,
          staff: false,
          youth: event.requiresChildcare,
          vendors: event.requiresVendors,
          finance: event.requiresTicketing,
          waitlist: false,
        },
        ticketing_config: {
          attendanceMode: event.requiresTicketing ? "paid" : "open_public",
        },
        service_requirements: serviceRequirements,
        internal_notes: event.internalNotes,
      })
      .select("id")
      .single()

    if (error || !data?.id) {
      throw new Error(`Event ${event.eventName}: ${error?.message || "insert failed"}`)
    }

    if (venueIds.length > 0) {
      const { error: venueError } = await sb.from("internal_event_venues").insert(
        venueIds.map((venueId) => ({
          organization_id: args.orgId,
          internal_event_id: data.id,
          venue_id: venueId,
        }))
      )
      if (venueError) {
        throw new Error(`Event venues ${event.eventName}: ${venueError.message}`)
      }
      const { error: touchError } = await sb
        .from("internal_events")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("organization_id", args.orgId)
      if (touchError) {
        throw new Error(`Event venue sync ${event.eventName}: ${touchError.message}`)
      }
    }

    await upsertOperationalBrief(sb, args.orgId, { ...event, id: data.id }, contactId)
    created.events.push({ id: data.id, name: event.eventName })
  }

  const executeReport = {
    ...report,
    created,
  }
  const path = writeReport("execute", executeReport)
  console.log(
    JSON.stringify(
      {
        createdDepartments: created.departments,
        createdVenues: created.venues,
        contactsTouched: created.contacts,
        eventsCreated: created.events.length,
      },
      null,
      2
    )
  )
  console.log(`Execute report: ${path}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
