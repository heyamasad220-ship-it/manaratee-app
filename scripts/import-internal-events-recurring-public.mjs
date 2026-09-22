/**
 * Import public / drop-in recurring gatherings into Event Management.
 *
 * Series (September 2026):
 * - Learn, Love, Live the Quran — weekly Wed 9–10 AM MPH; last Wed of month is potluck 9–11 AM
 * - Thursday Halaqa for Ladies — weekly Thu 11 AM–2 PM MPH, 2026-05-28 through last Thu of May 2027
 * - Tuesday Night Live — weekly Tue 7–8:30 PM Youth Lounge (middle school girls; staff calendar only)
 * - Crochet Clique — four Saturdays, every two months: Oct 3, Dec 5, Feb 6, Apr 3
 * - Men Talk — Fridays 2026-06-12–2026-07-10 8–10 PM, plus named speaker nights from the form
 *
 * Public series are published to Community Calendar. Attendance is walk-in (open_public).
 * Her Space is not on InternalEvents.xlsx — skipped until dates are provided.
 *
 *   node scripts/import-internal-events-recurring-public.mjs
 *   node scripts/import-internal-events-recurring-public.mjs --execute
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "INTERNAL_EVENTS_RECURRING_PUBLIC_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const TZ = "America/Chicago"
const SUN = 0
const MON = 1
const TUE = 2
const WED = 3
const THU = 4
const FRI = 5
const SAT = 6

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
  const args = { execute: false, orgId: DEFAULT_ORG_ID }
  for (const arg of argv) {
    if (arg === "--execute") args.execute = true
    else if (arg.startsWith("--org-id=")) args.orgId = arg.slice("--org-id=".length)
  }
  return args
}

function pad(n) {
  return String(n).padStart(2, "0")
}

function toDateKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

function weekdayUtc(dateKey) {
  const parts = parseDateKey(dateKey)
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
}

function addDaysKey(dateKey, days) {
  const parts = parseDateKey(dateKey)
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return toDateKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
}

function weeklyKeys(startKey, endKey, weekday) {
  let cursor = startKey
  while (weekdayUtc(cursor) !== weekday) cursor = addDaysKey(cursor, 1)
  const keys = []
  while (cursor <= endKey) {
    keys.push(cursor)
    cursor = addDaysKey(cursor, 7)
  }
  return keys
}

function isLastWeekdayOfMonth(dateKey, weekday) {
  const parts = parseDateKey(dateKey)
  const last = new Date(Date.UTC(parts.year, parts.month, 0))
  while (last.getUTCDay() !== weekday) {
    last.setUTCDate(last.getUTCDate() - 1)
  }
  return (
    last.getUTCFullYear() === parts.year &&
    last.getUTCMonth() + 1 === parts.month &&
    last.getUTCDate() === parts.day
  )
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

function wallTimeToIso(dateKey, clock, timeZone = TZ) {
  const naiveUtc = new Date(`${dateKey}T${clock}Z`)
  const first = new Date(naiveUtc.getTime() - timeZoneOffsetMs(naiveUtc, timeZone))
  const adjusted = new Date(naiveUtc.getTime() - timeZoneOffsetMs(first, timeZone))
  return adjusted.toISOString()
}

function importKey(series, dateKey, name) {
  return createHash("sha1")
    .update(`${IMPORT_TAG}|${series}|${dateKey}|${name}`)
    .digest("hex")
    .slice(0, 16)
}

function eventStatus(endAt) {
  return new Date(endAt).getTime() < Date.now() ? "completed" : "confirmed"
}

function stableSeriesId(slug) {
  const hex = createHash("sha1").update(`${IMPORT_TAG}|series|${slug}`).digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function recurrenceWeekly(weekday, endDate, seriesId) {
  return {
    enabled: true,
    frequency: "weekly",
    interval: 1,
    weekdays: [weekday],
    endType: "date",
    endDate,
    seriesId,
  }
}

function buildOccurrence(input) {
  const startAt = wallTimeToIso(input.dateKey, input.startClock)
  const endAt = wallTimeToIso(input.dateKey, input.endClock)
  const key = importKey(input.seriesSlug, input.dateKey, input.name)
  return {
    importKey: key,
    seriesSlug: input.seriesSlug,
    name: input.name,
    departmentName: input.departmentName,
    eventTypeName: input.eventTypeName,
    venueNames: input.venueNames,
    description: input.description,
    dateKey: input.dateKey,
    startClock: input.startClock,
    endClock: input.endClock,
    startAt,
    endAt,
    status: eventStatus(endAt),
    publish: input.publish,
    audience: input.audience || ["Everyone"],
    eventTags: input.eventTags || ["Community"],
    estimatedAttendance: input.estimatedAttendance ?? null,
    coordinator: input.coordinator || null,
    recurrence: input.recurrence || null,
    internalNotes: [
      input.notes,
      `${IMPORT_TAG}:${key}`,
    ]
      .filter(Boolean)
      .join("\n"),
  }
}

function planOccurrences() {
  const planned = []
  const skipped = [
    {
      name: "Her Space",
      reason: "not_on_spreadsheet",
      detail:
        "No dates in InternalEvents.xlsx. Add custom dates and re-run, or create them in Event Management.",
    },
  ]

  const lllqSeriesId = stableSeriesId("learn-love-live-quran")
  const lllqEnd = "2027-05-26"
  const lllqCoordinator = {
    name: "Stacy Hope-Elsayed",
    email: "s.hope.elsayed@gmail.com",
    phone: null,
  }
  for (const dateKey of weeklyKeys("2026-08-19", lllqEnd, WED)) {
    const potluck = isLastWeekdayOfMonth(dateKey, WED)
    planned.push(
      buildOccurrence({
        seriesSlug: "learn-love-live-quran",
        name: potluck
          ? "Learn, Love, Live the Quran (monthly potluck)"
          : "Learn, Love, Live the Quran",
        departmentName: "Tarbiya",
        eventTypeName: "Religious Program",
        venueNames: ["Main Prayer Hall (MPH)"],
        description: potluck
          ? "Weekly Wednesday Halaqa/Tafsir with Dr. Eaman Attia. This meeting is the monthly potluck (9–11 AM)."
          : "Weekly Wednesday Halaqa/Tafsir with Dr. Eaman Attia. Open to the community, free, no registration.",
        dateKey,
        startClock: "09:00:00",
        endClock: potluck ? "11:00:00" : "10:00:00",
        publish: true,
        audience: ["Everyone", "Adults"],
        eventTags: ["Community", "Education"],
        estimatedAttendance: 40,
        coordinator: lllqCoordinator,
        recurrence: recurrenceWeekly(WED, lllqEnd, lllqSeriesId),
        notes: potluck
          ? "Last Wednesday of the month — potluck 9–11 AM."
          : "Weekly Wednesday 9–10 AM.",
      })
    )
  }

  const thuSeriesId = stableSeriesId("thursday-halaqa-ladies")
  const thuEnd = "2027-05-27"
  for (const dateKey of weeklyKeys("2026-05-28", thuEnd, THU)) {
    planned.push(
      buildOccurrence({
        seriesSlug: "thursday-halaqa-ladies",
        name: "Thursday Halaqa for Ladies",
        departmentName: "Tarbiya",
        eventTypeName: "Religious Program",
        venueNames: ["Main Prayer Hall (MPH)"],
        description:
          "Weekly Thursday halaqa for ladies. Open to the community, free, no registration. First Thursday on or after May 27, 2026 through the last Thursday of May 2027.",
        dateKey,
        startClock: "11:00:00",
        endClock: "14:00:00",
        publish: true,
        audience: ["Women"],
        eventTags: ["Community", "Education"],
        estimatedAttendance: null,
        recurrence: recurrenceWeekly(THU, thuEnd, thuSeriesId),
        notes:
          "May 27, 2026 was a Wednesday; series starts Thursday May 28, 2026.",
      })
    )
  }

  const tnlSeriesId = stableSeriesId("tuesday-night-live")
  const tnlEnd = "2027-05-18"
  const tnlCoordinator = {
    name: "Sada Mohsin",
    email: "sada.mohsin@gmail.com",
    phone: "502 594 7220",
  }
  for (const dateKey of weeklyKeys("2026-09-08", tnlEnd, TUE)) {
    planned.push(
      buildOccurrence({
        seriesSlug: "tuesday-night-live",
        name: "Tuesday Night Live",
        departmentName: "Youth",
        eventTypeName: "Community Event",
        venueNames: ["Youth Lounge"],
        description:
          "Middle school girls programming (Tuesday Night Live). Weekly in the Youth Lounge.",
        dateKey,
        startClock: "19:00:00",
        endClock: "20:30:00",
        publish: false,
        audience: ["Youth"],
        eventTags: ["Youth"],
        estimatedAttendance: 40,
        coordinator: tnlCoordinator,
        recurrence: recurrenceWeekly(TUE, tnlEnd, tnlSeriesId),
        notes: "Form listed 6:30–8:00 PM; staff set 7:00–8:30 PM. Not on Community Calendar.",
      })
    )
  }

  const crochetCoordinator = tnlCoordinator
  for (const dateKey of ["2026-10-03", "2026-12-05", "2027-02-06", "2027-04-03"]) {
    planned.push(
      buildOccurrence({
        seriesSlug: "crochet-clique",
        name: "Crochet Clique",
        departmentName: "Youth",
        eventTypeName: "Community Event",
        venueNames: ["New Youth Lounge (2nd floor - main building)"],
        description:
          "Crochet club for girls ages 10+. Open to the public. Four gatherings, once every two months.",
        dateKey,
        startClock: "10:00:00",
        endClock: "14:00:00",
        publish: true,
        audience: ["Youth", "Everyone"],
        eventTags: ["Youth", "Community"],
        estimatedAttendance: 30,
        coordinator: crochetCoordinator,
        notes:
          "Form range 10/3/26–4/3/27 Saturday; imported as four first-Saturdays every two months.",
      })
    )
  }

  const menTalkCoordinator = {
    name: "Hazem Tariq",
    email: "hazemtariq25@gmail.com",
    phone: "816-859-3855",
  }
  const menTalkVenues = ["Banquet Hall"]
  for (const dateKey of weeklyKeys("2026-06-12", "2026-07-10", FRI)) {
    planned.push(
      buildOccurrence({
        seriesSlug: "men-talk",
        name: "Men Talk",
        departmentName: "CYP",
        eventTypeName: "Community Event",
        venueNames: menTalkVenues,
        description:
          "Men Talk with esteemed sheikhs. Open to the community, free, no registration. 8–10 PM.",
        dateKey,
        startClock: "20:00:00",
        endClock: "22:00:00",
        publish: true,
        audience: ["Men"],
        eventTags: ["Community"],
        estimatedAttendance: 100,
        coordinator: menTalkCoordinator,
        notes: "Form window 6/12/26–7/10/26 Fridays.",
      })
    )
  }
  planned.push(
    buildOccurrence({
      seriesSlug: "men-talk",
      name: "Men Talk with Doctor Omar Hussain",
      departmentName: "CYP",
      eventTypeName: "Community Event",
      venueNames: ["Banquet Hall", "Youth Lounge"],
      description:
        "Interactive program with a prominent speaker plus Q/A. Open to the community, free, no registration.",
      dateKey: "2026-08-21",
      startClock: "20:30:00",
      endClock: "21:45:00",
      publish: true,
      audience: ["Men"],
      eventTags: ["Community"],
      estimatedAttendance: 75,
      coordinator: { ...menTalkCoordinator, email: "cyp@masdfw.org" },
    })
  )
  planned.push(
    buildOccurrence({
      seriesSlug: "men-talk",
      name: "Men Talk with Sheikh Oduro",
      departmentName: "CYP",
      eventTypeName: "Community Event",
      venueNames: ["Banquet Hall", "Youth Lounge"],
      description:
        "Interactive program for men with speakers, Q/A, and suhbah. Open to the community, free, no registration.",
      dateKey: "2026-09-04",
      startClock: "20:30:00",
      endClock: "21:45:00",
      publish: true,
      audience: ["Men"],
      eventTags: ["Community"],
      estimatedAttendance: 75,
      coordinator: { ...menTalkCoordinator, email: "cyp@masdfw.org" },
    })
  )

  return { planned, skipped }
}

function byLowerName(rows) {
  const map = new Map()
  for (const row of rows) map.set(String(row.name || "").trim().toLowerCase(), row)
  return map
}

async function ensureContact(sb, orgId, person) {
  if (!person) return null
  const { data, error } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: orgId,
    p_full_name: person.name,
    p_email: person.email || null,
    p_phone: person.phone || null,
    p_contact_type: "individual",
  })
  if (!error && data) return data
  const { data: created, error: insertError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: person.name,
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

async function insertEvent(sb, orgId, event, catalog) {
  const department = catalog.departments.get(event.departmentName.toLowerCase())
  const eventType = catalog.eventTypes.get(event.eventTypeName.toLowerCase())
  if (!department) throw new Error(`Missing department ${event.departmentName}`)
  if (!eventType) throw new Error(`Missing event type ${event.eventTypeName}`)
  const venueIds = event.venueNames.map((name) => {
    const venue = catalog.venues.get(name.toLowerCase())
    if (!venue) throw new Error(`Missing venue ${name}`)
    return venue.id
  })
  const contactId = event.coordinator
    ? catalog.contacts.get(event.coordinator.email || event.coordinator.name)
    : null

  const { data, error } = await sb
    .from("internal_events")
    .insert({
      organization_id: orgId,
      department_id: department.id,
      event_type_id: eventType.id,
      name: event.name,
      description: event.description,
      status: event.status,
      start_at: event.startAt,
      end_at: event.endAt,
      timezone: TZ,
      location_type: "facility",
      location_label: event.venueNames[0],
      venue_id: venueIds[0] || null,
      coordinator_contact_id: contactId || null,
      estimated_attendance: event.estimatedAttendance,
      requires_childcare: false,
      requires_vendors: false,
      requires_ticketing: false,
      requires_volunteers: false,
      community_calendar_status: event.publish ? "published" : "not_published",
      audience: event.audience,
      event_tags: event.eventTags,
      workspace_features: {
        registration: false,
        staff: false,
        youth: false,
        vendors: false,
        finance: false,
        waitlist: false,
      },
      ticketing_config: { attendanceMode: "open_public" },
      recurrence_config: event.recurrence,
      internal_notes: event.internalNotes,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    throw new Error(`Event ${event.name} ${event.dateKey}: ${error?.message || "insert failed"}`)
  }

  if (venueIds.length > 0) {
    const { error: venueError } = await sb.from("internal_event_venues").insert(
      venueIds.map((venueId) => ({
        organization_id: orgId,
        internal_event_id: data.id,
        venue_id: venueId,
      }))
    )
    if (venueError) {
      throw new Error(`Venues ${event.name}: ${venueError.message}`)
    }
    await sb
      .from("internal_events")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", orgId)
  }

  const { error: briefError } = await sb.from("operational_briefs").insert({
    organization_id: orgId,
    source_type: "internal_event",
    source_id: data.id,
    title: event.name,
    event_date: event.dateKey,
    start_time: event.startClock,
    end_time: event.endClock,
    primary_contact_person_id: contactId || null,
    primary_contact_name: event.coordinator?.name || null,
    primary_contact_phone: event.coordinator?.phone || null,
    internal_coordinator_person_id: contactId || null,
    internal_coordinator_name: event.coordinator?.name || null,
    internal_coordinator_email: event.coordinator?.email || null,
    expected_attendance: event.estimatedAttendance,
    source_status: event.status,
    setup_status: event.status === "completed" ? "closed" : "ready_for_setup",
    visibility_level: "staff",
  })
  if (briefError) {
    throw new Error(`Brief ${event.name}: ${briefError.message}`)
  }

  return data.id
}

function summarize(planned) {
  const bySeries = {}
  for (const row of planned) {
    if (!bySeries[row.seriesSlug]) {
      bySeries[row.seriesSlug] = {
        count: 0,
        publish: row.publish,
        first: row.dateKey,
        last: row.dateKey,
        sample: row.name,
      }
    }
    const bucket = bySeries[row.seriesSlug]
    bucket.count += 1
    if (row.dateKey < bucket.first) bucket.first = row.dateKey
    if (row.dateKey > bucket.last) bucket.last = row.dateKey
  }
  return bySeries
}

function writeReport(kind, payload) {
  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, `internal-events-recurring-public-${kind}.json`)
  writeFileSync(path, JSON.stringify(payload, null, 2))
  return path
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const { planned, skipped } = planOccurrences()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const [{ data: departments }, { data: venues }, { data: eventTypes }, { data: existing }] =
    await Promise.all([
      sb.from("departments").select("id, name").eq("organization_id", args.orgId),
      sb.from("venues").select("id, name").eq("organization_id", args.orgId),
      sb.from("event_types").select("id, name").eq("organization_id", args.orgId).eq("is_active", true),
      sb
        .from("internal_events")
        .select("id, internal_notes")
        .eq("organization_id", args.orgId)
        .ilike("internal_notes", `%${IMPORT_TAG}:%`),
    ])

  const importedKeys = new Set()
  for (const row of existing || []) {
    const match = String(row.internal_notes || "").match(
      new RegExp(`${IMPORT_TAG}:([a-f0-9]{16})`)
    )
    if (match) importedKeys.add(match[1])
  }

  const toInsert = planned.filter((row) => !importedKeys.has(row.importKey))
  const report = {
    mode: args.execute ? "execute" : "dry-run",
    planned: planned.length,
    alreadyImported: planned.length - toInsert.length,
    toInsert: toInsert.length,
    bySeries: summarize(planned),
    skipped,
    potluckDates: planned
      .filter((row) => row.name.includes("potluck"))
      .map((row) => row.dateKey),
  }

  console.log(JSON.stringify({ ...report, events: undefined }, null, 2))

  if (!args.execute) {
    console.log(`Dry-run report: ${writeReport("dry-run", report)}`)
    return
  }

  const catalog = {
    departments: byLowerName(departments || []),
    venues: byLowerName(venues || []),
    eventTypes: byLowerName(eventTypes || []),
    contacts: new Map(),
  }

  for (const person of toInsert.map((row) => row.coordinator).filter(Boolean)) {
    const mapKey = person.email || person.name
    if (catalog.contacts.has(mapKey)) continue
    catalog.contacts.set(mapKey, await ensureContact(sb, args.orgId, person))
  }

  const created = []
  for (const event of toInsert) {
    const id = await insertEvent(sb, args.orgId, event, catalog)
    created.push({ id, name: event.name, date: event.dateKey })
  }

  const executeReport = { ...report, createdCount: created.length, created }
  console.log(`Created ${created.length} events`)
  console.log(`Execute report: ${writeReport("execute", executeReport)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
