/**
 * MUHSEN Sunday School as a Programs year, plus Sabiqoon and Men in the Making
 * as Event Management walk-in series (like Tuesday Night Live, published).
 *
 *   node scripts/import-muhsen-sabiqoon-men-in-the-making.mjs
 *   node scripts/import-muhsen-sabiqoon-men-in-the-making.mjs --execute
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "MUHSEN_SABIQOON_MITM_V1"
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const TZ = "America/Chicago"
const SUN = 0
const SAT = 6
const PROGRAM_NAME = "MUHSEN Sunday School 2026-2027"

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

function pad(n) {
  return String(n).padStart(2, "0")
}

function toDateKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
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
  return new Date(naiveUtc.getTime() - timeZoneOffsetMs(first, timeZone)).toISOString()
}

function importKey(series, dateKey, name) {
  return createHash("sha1")
    .update(`${IMPORT_TAG}|${series}|${dateKey}|${name}`)
    .digest("hex")
    .slice(0, 16)
}

function stableSeriesId(slug) {
  const hex = createHash("sha1").update(`${IMPORT_TAG}|series|${slug}`).digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function eventStatus(endAt) {
  return new Date(endAt).getTime() < Date.now() ? "completed" : "confirmed"
}

function byLowerName(rows) {
  const map = new Map()
  for (const row of rows) map.set(String(row.name || "").trim().toLowerCase(), row)
  return map
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
    publish: true,
    audience: input.audience,
    eventTags: input.eventTags,
    estimatedAttendance: input.estimatedAttendance,
    coordinator: input.coordinator,
    recurrence: input.recurrence,
    internalNotes: [input.notes, `${IMPORT_TAG}:${key}`].filter(Boolean).join("\n"),
  }
}

function planEvents() {
  const planned = []
  const sabiqoonId = stableSeriesId("sabiqoon")
  const sabiqoonCoord = {
    name: "Aya Mustafa",
    email: "syc@masdfw.org",
    phone: "4142499048",
  }
  for (const dateKey of weeklyKeys("2026-05-31", "2026-06-28", SUN)) {
    planned.push(
      buildOccurrence({
        seriesSlug: "sabiqoon",
        name: "Sabiqoon",
        departmentName: "Youth",
        eventTypeName: "Religious Program",
        venueNames: ["Youth Lounge"],
        description:
          "Five-week Qur’an Tarbiya cohort for high school students on the earliest revelations. Open to the public, free, no registration.",
        dateKey,
        startClock: "11:00:00",
        endClock: "13:00:00",
        audience: ["Youth"],
        eventTags: ["Youth", "Education", "Community"],
        estimatedAttendance: 20,
        coordinator: sabiqoonCoord,
        recurrence: {
          enabled: true,
          frequency: "weekly",
          interval: 1,
          weekdays: [SUN],
          endType: "date",
          endDate: "2026-06-28",
          seriesId: sabiqoonId,
        },
        notes:
          "Form had no clock time. Set to Sunday 11:00 AM–1:00 PM pending confirmation.",
      })
    )
  }

  const mitmCoord = {
    name: "Yaman Khanshour",
    email: "yamansinnin@gmail.com",
    phone: "9452361576",
  }
  const mitmA = stableSeriesId("men-in-the-making-jul")
  for (const dateKey of weeklyKeys("2026-07-04", "2026-07-25", SAT)) {
    planned.push(
      buildOccurrence({
        seriesSlug: "men-in-the-making",
        name: "Men in the Making",
        departmentName: "Youth",
        eventTypeName: "Community Event",
        venueNames: [
          "Main Prayer Hall (MPH)",
          "Pool Room (1st floor - main building)",
          "Pool",
        ],
        description:
          "Halaqah, soccer, and swimming. Open to the public, free, no registration.",
        dateKey,
        startClock: "12:00:00",
        endClock: "14:45:00",
        audience: ["Youth", "Men"],
        eventTags: ["Youth", "Community"],
        estimatedAttendance: 50,
        coordinator: mitmCoord,
        recurrence: {
          enabled: true,
          frequency: "weekly",
          interval: 1,
          weekdays: [SAT],
          endType: "date",
          endDate: "2026-07-25",
          seriesId: mitmA,
        },
        notes:
          "First form window Jul 4–Aug 8. Aug 1+ uses the later form (rooms/time changed).",
      })
    )
  }
  const mitmB = stableSeriesId("men-in-the-making-aug")
  for (const dateKey of weeklyKeys("2026-08-01", "2026-09-05", SAT)) {
    planned.push(
      buildOccurrence({
        seriesSlug: "men-in-the-making",
        name: "Men in the Making",
        departmentName: "Youth",
        eventTypeName: "Community Event",
        venueNames: ["Main Prayer Hall (MPH)", "Banquet Hall", "Pool"],
        description:
          "Halaqah about Yawm al-Qiyamah, soccer, and swimming. Open to the public, free, no registration.",
        dateKey,
        startClock: "12:00:00",
        endClock: "15:00:00",
        audience: ["Youth", "Men"],
        eventTags: ["Youth", "Community"],
        estimatedAttendance: 50,
        coordinator: mitmCoord,
        recurrence: {
          enabled: true,
          frequency: "weekly",
          interval: 1,
          weekdays: [SAT],
          endType: "date",
          endDate: "2026-09-05",
          seriesId: mitmB,
        },
        notes: "Second form window Aug 1–Sep 5, 12:00–3:00 PM.",
      })
    )
  }
  return planned
}

async function ensureContact(sb, orgId, person) {
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
  if (insertError) throw new Error(insertError.message)
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
  const contactId = catalog.contacts.get(event.coordinator.email)
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
      venue_id: venueIds[0],
      coordinator_contact_id: contactId || null,
      estimated_attendance: event.estimatedAttendance,
      requires_childcare: false,
      requires_vendors: false,
      requires_ticketing: false,
      requires_volunteers: false,
      community_calendar_status: "published",
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
  if (error || !data?.id) throw new Error(`${event.name} ${event.dateKey}: ${error?.message}`)
  await sb.from("internal_event_venues").insert(
    venueIds.map((venueId) => ({
      organization_id: orgId,
      internal_event_id: data.id,
      venue_id: venueId,
    }))
  )
  await sb
    .from("internal_events")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", data.id)
  await sb.from("operational_briefs").insert({
    organization_id: orgId,
    source_type: "internal_event",
    source_id: data.id,
    title: event.name,
    event_date: event.dateKey,
    start_time: event.startClock,
    end_time: event.endClock,
    primary_contact_person_id: contactId || null,
    primary_contact_name: event.coordinator.name,
    internal_coordinator_person_id: contactId || null,
    internal_coordinator_name: event.coordinator.name,
    internal_coordinator_email: event.coordinator.email,
    expected_attendance: event.estimatedAttendance,
    source_status: event.status,
    setup_status: event.status === "completed" ? "closed" : "ready_for_setup",
    visibility_level: "staff",
  })
  return data.id
}

async function ensureMuhsenProgram(sb, orgId, execute) {
  const { data: dept } = await sb
    .from("departments")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", "Education")
    .maybeSingle()
  if (!dept) throw new Error("Education department not found")

  if (!execute) {
    return { programId: "dry-run", created: true, offeringId: "dry-run" }
  }

  const leadId = await ensureContact(sb, orgId, {
    name: "Aliya Alison Lee",
    email: "aleeslp@gmail.com",
    phone: "2147731933",
  })
  const { data: venue } = await sb
    .from("venues")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", "Youth Lounge")
    .maybeSingle()

  const { data: existingProgram } = await sb
    .from("programs")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()

  let program = existingProgram
  let programCreated = false
  if (!program) {
    const { data, error } = await sb
      .from("programs")
      .insert({
        organization_id: orgId,
        department_id: dept.id,
        name: PROGRAM_NAME,
        subtitle: "Special needs religious studies, ages 5–12",
        description:
          "Sunday school concurrent with the 2026–2027 school schedule. Religious studies and interventions for students ages 5–12 with special needs. Class 10:00 AM–1:00 PM (setup 9:30 AM) in the Youth Lounge. Lead: Aliya Alison Lee.",
        start_date: "2026-08-30",
        end_date: "2027-05-30",
        enrollment_open_date: "2026-08-01",
        enrollment_close_date: "2027-05-30",
        program_type: "youth",
        program_kind: "academic",
        min_age: 5,
        max_age: 12,
        require_guardian: true,
        require_emergency_contact: true,
        capacity: 5,
        enrolled: 0,
        waitlist: 0,
        enable_waitlist: true,
        status: "active",
        visibility: "public",
        billing_type: "one_time",
        tuition_amount: 0,
        full_program_registration_enabled: true,
        session_registration_enabled: false,
        enrollment_process: "direct_registration",
        seat_activation_rule: "on_registration",
        lead_contact_id: leadId,
      })
      .select("id")
      .single()
    if (error || !data?.id) throw new Error(`program: ${error?.message}`)
    program = data
    programCreated = true
  } else {
    await sb
      .from("programs")
      .update({
        lead_contact_id: leadId,
        billing_type: "one_time",
        visibility: "public",
        enrollment_process: "direct_registration",
        updated_at: new Date().toISOString(),
      })
      .eq("id", program.id)
  }

  const { data: existingOffering } = await sb
    .from("program_offerings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("program_id", program.id)
    .eq("name", "Ages 5-12")
    .maybeSingle()

  let offering = existingOffering
  if (!offering) {
    const { data, error } = await sb
      .from("program_offerings")
      .insert({
        organization_id: orgId,
        program_id: program.id,
        name: "Ages 5-12",
        is_default: true,
        offering_type: "academic_year",
        audience_type: "youth",
        start_date: "2026-08-30",
        end_date: "2027-05-30",
        enrollment_open_date: "2026-08-01",
        enrollment_close_date: "2027-05-30",
        status: "active",
        min_age: 5,
        max_age: 12,
        capacity: 5,
        capacity_mode: "limited",
        require_guardian: true,
        require_emergency_contact: true,
        application_required: false,
        delivery_format: "in_person",
        inherit_dates: true,
        inherit_eligibility: true,
        inherit_enrollment: true,
        enable_waitlist: true,
      })
      .select("id")
      .single()
    if (error || !data?.id) throw new Error(`offering: ${error?.message}`)
    offering = data
  }

  const { data: existingSchedule } = await sb
    .from("program_schedule_items")
    .select("id")
    .eq("organization_id", orgId)
    .eq("offering_id", offering.id)
    .maybeSingle()
  if (!existingSchedule) {
    const { error } = await sb.from("program_schedule_items").insert({
      organization_id: orgId,
      program_id: program.id,
      offering_id: offering.id,
      title: "MUHSEN Sunday School",
      day_of_week: "sunday",
      start_time: "09:30:00",
      end_time: "13:00:00",
      location: "Youth Lounge",
      venue_id: venue?.id || null,
      instructor_name: "Aliya Alison Lee",
      capacity: 5,
      color: "bg-blue-500",
      is_recurring: true,
    })
    if (error) throw new Error(`schedule: ${error.message}`)
  }

  const { data: existingPlan } = await sb
    .from("program_offering_fee_plans")
    .select("id")
    .eq("organization_id", orgId)
    .eq("offering_id", offering.id)
    .eq("name", "Tuition")
    .maybeSingle()
  let plan = existingPlan
  if (!plan) {
    const { data, error } = await sb
      .from("program_offering_fee_plans")
      .insert({
        organization_id: orgId,
        program_id: program.id,
        offering_id: offering.id,
        name: "Tuition",
        plan_type: "one_time",
        currency: "USD",
        is_default: true,
        is_active: true,
        deposit_amount: 0,
        notes:
          "Tuition amount was not on the facility request form. Set the price on this fee plan before taking payments.",
        metadata: { import_tag: IMPORT_TAG, tuition_pending: true },
      })
      .select("id")
      .single()
    if (error || !data?.id) throw new Error(`fee plan: ${error?.message}`)
    plan = data
  }

  const { data: existingComponent } = await sb
    .from("program_offering_fee_plan_components")
    .select("id")
    .eq("fee_plan_id", plan.id)
    .eq("component_type", "tuition")
    .maybeSingle()
  if (!existingComponent) {
    const { error } = await sb.from("program_offering_fee_plan_components").insert({
      organization_id: orgId,
      fee_plan_id: plan.id,
      component_type: "tuition",
      label: "Tuition",
      amount: 0,
      pricing_model: "flat",
      quantity_mode: "fixed",
      quantity_value: 1,
      sort_order: 10,
      billing_scope: "individual",
      session_price_source: "component",
      is_active: true,
    })
    if (error) throw new Error(`tuition component: ${error.message}`)
  }

  const { data: existingOption } = await sb
    .from("program_registration_options")
    .select("id")
    .eq("organization_id", orgId)
    .eq("offering_id", offering.id)
    .eq("option_type", "full_program")
    .maybeSingle()
  if (!existingOption) {
    const { error } = await sb.from("program_registration_options").insert({
      organization_id: orgId,
      program_id: program.id,
      offering_id: offering.id,
      name: "Full Program",
      option_type: "full_program",
      is_active: true,
      priority_rank: 10,
    })
    if (error) throw new Error(`registration option: ${error.message}`)
  }

  return {
    programId: program.id,
    offeringId: offering.id,
    created: programCreated,
    leadId,
  }
}

function writeReport(kind, payload) {
  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const path = resolve(dir, `muhsen-sabiqoon-mitm-${kind}.json`)
  writeFileSync(path, JSON.stringify(payload, null, 2))
  return path
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const planned = planEvents()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env")
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const [{ data: departments }, { data: venues }, { data: eventTypes }, { data: existing }] =
    await Promise.all([
      sb.from("departments").select("id, name").eq("organization_id", ORG_ID),
      sb.from("venues").select("id, name").eq("organization_id", ORG_ID),
      sb.from("event_types").select("id, name").eq("organization_id", ORG_ID).eq("is_active", true),
      sb
        .from("internal_events")
        .select("id, internal_notes")
        .eq("organization_id", ORG_ID)
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
  const bySeries = {}
  for (const row of planned) {
    bySeries[row.seriesSlug] = (bySeries[row.seriesSlug] || 0) + 1
  }

  const report = {
    mode: execute ? "execute" : "dry-run",
    muhsenProgram: PROGRAM_NAME,
    eventsPlanned: planned.length,
    eventsToInsert: toInsert.length,
    bySeries,
  }
  console.log(JSON.stringify(report, null, 2))

  if (!execute) {
    console.log(`Dry-run: ${writeReport("dry-run", { ...report, events: planned })}`)
    return
  }

  const muhsen = await ensureMuhsenProgram(sb, ORG_ID, true)
  const catalog = {
    departments: byLowerName(departments || []),
    venues: byLowerName(venues || []),
    eventTypes: byLowerName(eventTypes || []),
    contacts: new Map(),
  }
  for (const person of toInsert.map((row) => row.coordinator)) {
    if (catalog.contacts.has(person.email)) continue
    catalog.contacts.set(person.email, await ensureContact(sb, ORG_ID, person))
  }
  const created = []
  for (const event of toInsert) {
    created.push({
      id: await insertEvent(sb, ORG_ID, event, catalog),
      name: event.name,
      date: event.dateKey,
    })
  }
  const executeReport = { ...report, muhsen, createdCount: created.length, created }
  console.log(`MUHSEN program ${muhsen.created ? "created" : "already existed"}: ${muhsen.programId}`)
  console.log(`Created ${created.length} events`)
  console.log(`Execute report: ${writeReport("execute", executeReport)}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
