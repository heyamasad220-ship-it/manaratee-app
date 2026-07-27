/**
 * Import Google Form venue rental responses → venue_rentals + contacts.
 *
 * Rules (July 2026):
 * - Banquet Hall and/or Youth Lounge only (other spaces skipped)
 * - Both halls → one rental with two reservation slots
 * - Missing / "Option 1" end time → start + 4 hours
 * - Merge duplicate email + event date + venue set (keep latest Timestamp)
 * - Create/match contacts; add to "Venue Rental" contact group
 * - Map sheet Status → app statuses (no payment rows)
 * - Full history (past + future)
 *
 * Usage (dry-run by default):
 *   node scripts/import-venue-rental-form-responses.mjs
 *   node scripts/import-venue-rental-form-responses.mjs --csv "C:/Users/danan/Downloads/Venue Rental (Responses) - Form Responses 1.csv"
 *   node scripts/import-venue-rental-form-responses.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "VENUE_RENTAL_GOOGLE_FORM_V1"
const GROUP_NAME = "Venue Rental"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV =
  "C:/Users/danan/Downloads/Venue Rental (Responses) - Form Responses 1.csv"
const DEFAULT_HOURS = 4

/** Sheet Status → app venue_rentals.status */
const STATUS_MAP = {
  "": null, // resolved later from event date
  approved: "approved_pending_payment",
  "deposit received": "confirmed",
  complete: "completed",
  completed: "completed",
  cancelled: "cancelled_before_payment",
  canceled: "cancelled_before_payment",
  "pending payment": "approved_pending_payment",
  "conflict - not available": "declined",
  declined: "declined",
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
    csv: DEFAULT_CSV,
    execute: false,
    orgId: DEFAULT_ORG_ID,
    limit: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--csv") args.csv = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
    else if (arg === "--limit") args.limit = Number(argv[++i])
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

/** Map free-text form labels onto catalog names when possible. */
function canonicalEventTypeName(raw) {
  const value = normalizeText(raw)
  if (!value) return null
  const lower = value.toLowerCase()

  // Exact / prefix matches for known Google Form choices (check before keyword rules)
  const formOptions = [
    {
      test: /^party\s*\(/,
      name: "Wedding / Engagement Party",
    },
    {
      test: /^dinner\s*\(/,
      name: "Dinner / Iftar",
    },
    {
      test: /^conference|^seminar|meeting,\s*etc/,
      name: "Meeting",
    },
    { test: /^workshop$/, name: "Workshop" },
    { test: /^henna/, name: "Henna Party" },
    { test: /^film\s*festival/, name: "Film Festival" },
    { test: /^aqeeqa|^aqiqa|^aqiqah/, name: "Aqeeqa" },
  ]
  for (const option of formOptions) {
    if (option.test.test(lower)) return option.name
  }

  const rules = [
    { test: /henna/, name: "Henna Party" },
    { test: /graduation/, name: "Graduation Party" },
    { test: /wedding|nikkah|nikah|katb/, name: "Wedding" },
    { test: /engagement/, name: "Engagement" },
    { test: /baby\s*shower/, name: "Baby Shower" },
    { test: /aqeeqa|aqiqa|aqiqah/, name: "Aqeeqa" },
    { test: /birthday/, name: "Birthday Party" },
    { test: /memorial|condolence|aza\b|janazah/, name: "Memorial Service" },
    { test: /workshop/, name: "Workshop" },
    { test: /corporate|conference|seminar/, name: "Corporate Event" },
    { test: /\bmeeting\b/, name: "Meeting" },
    { test: /iftar|ramadan|quran|khutbah|religious/, name: "Religious Ceremony" },
    { test: /dinner|party|reception/, name: "Other" },
  ]

  for (const rule of rules) {
    if (rule.test.test(lower)) return rule.name
  }

  return value.length > 80 ? `${value.slice(0, 77)}…` : value
}

async function ensureEventType(sb, orgId, name, cacheBySlug, cacheByName) {
  const slug = slugify(name) || "other"
  if (cacheBySlug.has(slug)) return cacheBySlug.get(slug)
  const nameKey = name.toLowerCase()
  if (cacheByName.has(nameKey)) return cacheByName.get(nameKey)

  const { data: existing } = await sb
    .from("venue_rental_event_types")
    .select("id, name, slug")
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .maybeSingle()

  if (existing) {
    cacheBySlug.set(existing.slug, existing)
    cacheByName.set(existing.name.toLowerCase(), existing)
    return existing
  }

  const { data: created, error } = await sb
    .from("venue_rental_event_types")
    .insert({
      organization_id: orgId,
      name,
      slug,
      is_active: true,
      sort_order: 50,
      description: "Created from Google Form venue rental import",
    })
    .select("id, name, slug")
    .single()

  if (error) {
    const { data: again } = await sb
      .from("venue_rental_event_types")
      .select("id, name, slug")
      .eq("organization_id", orgId)
      .eq("slug", slug)
      .maybeSingle()
    if (again) {
      cacheBySlug.set(again.slug, again)
      cacheByName.set(again.name.toLowerCase(), again)
      return again
    }
    throw new Error(error.message)
  }

  cacheBySlug.set(created.slug, created)
  cacheByName.set(created.name.toLowerCase(), created)
  return created
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function normalizePhone(value) {
  return normalizeText(value).replace(/\D/g, "")
}

function formatPhoneForStorage(value) {
  const digits = normalizePhone(value)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return normalizeText(value) || null
}

function nthSunday(year, monthIndex0, n) {
  const first = new Date(Date.UTC(year, monthIndex0, 1))
  const day = first.getUTCDay()
  const firstSunday = 1 + ((7 - day) % 7)
  return firstSunday + (n - 1) * 7
}

/** Central Time offset minutes east of UTC (negative). DST: 2nd Sun Mar → 1st Sun Nov. */
function chicagoOffsetMinutes(year, month, day) {
  const dstStart = nthSunday(year, 2, 2)
  const dstEnd = nthSunday(year, 10, 1)
  const inDst =
    month > 3 && month < 11
      ? true
      : month === 3
        ? day >= dstStart
        : month === 11
          ? day < dstEnd
          : false
  return inDst ? -5 * 60 : -6 * 60
}

function parseUsDate(value) {
  const text = normalizeText(value)
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  return {
    month: Number(match[1]),
    day: Number(match[2]),
    year: Number(match[3]),
  }
}

function parseTimeParts(value) {
  const text = normalizeText(value)
  if (!text || /^option\s*\d+$/i.test(text)) return null
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] || 0)
  const meridiem = match[4].toUpperCase()
  if (meridiem === "PM" && hour < 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 0
  return { hour, minute, second }
}

function toChicagoIso(dateParts, timeParts) {
  const { year, month, day } = dateParts
  const { hour, minute, second } = timeParts
  const offsetMin = chicagoOffsetMinutes(year, month, day)
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute, second) - offsetMin * 60_000
  return new Date(utcMs).toISOString()
}

function addHoursIso(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString()
}

function parseAttendance(value) {
  const text = normalizeText(value)
  if (!text) return null
  const match = text.match(/\d+/)
  return match ? Number(match[0]) : null
}

function venueKeysFromLabel(venueName) {
  const lower = normalizeText(venueName).toLowerCase()
  const keys = []
  if (lower.includes("banquet")) keys.push("banquet")
  if (lower.includes("youth")) keys.push("youth")
  return keys
}

function mapSheetStatus(rawStatus, endAtIso) {
  const key = normalizeText(rawStatus).toLowerCase()
  const mapped = Object.prototype.hasOwnProperty.call(STATUS_MAP, key)
    ? STATUS_MAP[key]
    : null
  if (mapped) return mapped
  if (key && !STATUS_MAP[key] && key.length > 0) {
    // Unknown non-empty status → submitted, keep original in notes
    return "submitted"
  }
  const ended = new Date(endAtIso).getTime() < Date.now()
  return ended ? "completed" : "submitted"
}

function reservationStatusForRental(rentalStatus) {
  if (
    rentalStatus === "cancelled_before_payment" ||
    rentalStatus === "cancelled_after_payment" ||
    rentalStatus === "declined" ||
    rentalStatus === "hold_expired"
  ) {
    return "cancelled"
  }
  if (
    rentalStatus === "confirmed" ||
    rentalStatus === "completed" ||
    rentalStatus === "closed" ||
    // legacy aliases
    rentalStatus === "deposit_paid" ||
    rentalStatus === "security_deposit_paid"
  ) {
    return "confirmed"
  }
  return "temporary_hold"
}

function importKey(parts) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)
}

function pickField(row, names) {
  for (const name of names) {
    if (row[name] != null && String(row[name]).trim() !== "") {
      return row[name]
    }
  }
  // Duplicate headers (e.g. Email Address) — Papa renames to Email Address_1, etc.
  const keys = Object.keys(row)
  for (const name of names) {
    const needle = name.trim().toLowerCase()
    const found = keys.find((k) => {
      const key = k.trim().toLowerCase()
      return key === needle || key.startsWith(`${needle}_`)
    })
    if (found && normalizeText(row[found])) return row[found]
  }
  return ""
}

function pickEmail(row) {
  const direct = normalizeEmail(pickField(row, ["Email Address"]))
  if (direct) return direct
  for (const [key, value] of Object.entries(row)) {
    if (!/email/i.test(key)) continue
    const email = normalizeEmail(value)
    if (email && email.includes("@")) return email
  }
  return ""
}

function buildNotes(row, sheetStatus, venueLabel) {
  const chunks = [
    `[${IMPORT_TAG}]`,
    `Form submitted: ${normalizeText(row.Timestamp) || "n/a"}`,
    `Sheet venue: ${venueLabel}`,
    sheetStatus ? `Sheet status: ${sheetStatus}` : null,
    normalizeText(row["Type of Event"])
      ? `Event type: ${normalizeText(row["Type of Event"])}`
      : null,
    normalizeText(row.Setup) ? `Setup: ${normalizeText(row.Setup)}` : null,
    normalizeText(row["Food Type"])
      ? `Food: ${normalizeText(row["Food Type"])}`
      : null,
    normalizeText(row["Special needs for the event"])
      ? `Special needs: ${normalizeText(row["Special needs for the event"])}`
      : null,
    normalizeText(row["Will you be charging admission fees?"])
      ? `Admission fees: ${normalizeText(row["Will you be charging admission fees?"])}`
      : null,
    normalizeText(
      row["Notes (Please add any information not listed above)"]
    )
      ? `Notes: ${normalizeText(row["Notes (Please add any information not listed above)"])}`
      : null,
    "(Payments not imported in this batch.)",
  ]
  return chunks.filter(Boolean).join("\n")
}

function parseCsvRows(csvPath) {
  const text = readFileSync(csvPath, "utf8")
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  })
  if (parsed.errors?.length) {
    console.warn("CSV parse warnings:", parsed.errors.slice(0, 5))
  }
  return (parsed.data || []).filter((row) => {
    const name = normalizeText(pickField(row, ["Renter Full Name"]))
    const venue = normalizeText(pickField(row, ["Venue Name"]))
    const date = normalizeText(pickField(row, ["Event Date"]))
    return Boolean(name || venue || date)
  })
}

function resolveVenueIds(venueKeys, venueByKey) {
  const ids = []
  for (const key of venueKeys) {
    const venue = venueByKey.get(key)
    if (!venue) return { ok: false, missing: key, ids: [] }
    ids.push(venue.id)
  }
  return { ok: true, ids: [...new Set(ids)], missing: null }
}

function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  if (!existsSync(args.csv)) {
    console.error(`CSV not found: ${args.csv}`)
    process.exit(1)
  }

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    csv: args.csv,
    totalRows: 0,
    skippedNoBanquetYouth: 0,
    skippedBadDate: 0,
    skippedBadStart: 0,
    skippedMissingVenueRecord: 0,
    mergedDuplicates: 0,
    plannedRentals: 0,
    contactsMatched: 0,
    contactsCreated: 0,
    groupMemberships: 0,
    rentalsCreated: 0,
    reservationsCreated: 0,
    alreadyImported: 0,
    errors: [],
    sample: [],
    skippedSamples: [],
  }

  const rawRows = parseCsvRows(args.csv)
  report.totalRows = rawRows.length

  /** @type {Map<string, object>} */
  const merged = new Map()

  for (const row of rawRows) {
    const venueLabel = normalizeText(pickField(row, ["Venue Name"]))
    const venueKeys = venueKeysFromLabel(venueLabel)
    if (venueKeys.length === 0) {
      report.skippedNoBanquetYouth += 1
      if (report.skippedSamples.length < 8) {
        report.skippedSamples.push({
          reason: "not_banquet_or_youth",
          venue: venueLabel,
          name: normalizeText(pickField(row, ["Renter Full Name"])),
        })
      }
      continue
    }

    const eventDate = parseUsDate(pickField(row, ["Event Date"]))
    if (!eventDate) {
      report.skippedBadDate += 1
      continue
    }

    const startParts = parseTimeParts(pickField(row, ["Event Start Time"]))
    if (!startParts) {
      report.skippedBadStart += 1
      continue
    }

    const endRaw = pickField(row, [
      "Event End Time   (10pm is the absolute latest allowed)",
      "Event End Time",
    ])
    let endParts = parseTimeParts(endRaw)
    const startAt = toChicagoIso(eventDate, startParts)
    let endAt = endParts
      ? toChicagoIso(eventDate, endParts)
      : addHoursIso(startAt, DEFAULT_HOURS)

    // Overnight / end before start (e.g. 10:00:00 AM typed for end) → +4h from start
    if (new Date(endAt) <= new Date(startAt)) {
      endAt = addHoursIso(startAt, DEFAULT_HOURS)
      endParts = null
    }

    const email = pickEmail(row)
    const phone = normalizePhone(pickField(row, ["Phone Number"]))
    const fullName = normalizeText(pickField(row, ["Renter Full Name"])) || "Unknown renter"
    const sheetStatus = normalizeText(pickField(row, ["Status"]))
    const rentalStatus = mapSheetStatus(sheetStatus, endAt)
    const attendance = parseAttendance(
      pickField(row, ["Expected number of guests"])
    )
    const timestamp = normalizeText(pickField(row, ["Timestamp"]))
    const dedupeKey = [
      email || `phone:${phone}` || `name:${fullName.toLowerCase()}`,
      `${eventDate.year}-${eventDate.month}-${eventDate.day}`,
      [...venueKeys].sort().join("+"),
    ].join("|")

    const candidate = {
      dedupeKey,
      timestamp,
      timestampMs: Date.parse(timestamp) || 0,
      fullName,
      email: email || null,
      phone: formatPhoneForStorage(pickField(row, ["Phone Number"])),
      phoneDigits: phone,
      venueLabel,
      venueKeys,
      startAt,
      endAt,
      endTimeDefaulted: !endParts,
      sheetStatus: sheetStatus || null,
      rentalStatus,
      reservationStatus: reservationStatusForRental(rentalStatus),
      attendance,
      notes: buildNotes(row, sheetStatus, venueLabel),
      eventType: normalizeText(pickField(row, ["Type of Event"])) || null,
      importKey: importKey([
        IMPORT_TAG,
        email || phone || fullName,
        `${eventDate.year}-${eventDate.month}-${eventDate.day}`,
        startAt,
        [...venueKeys].sort().join("+"),
      ]),
    }

    const existing = merged.get(dedupeKey)
    if (!existing) {
      merged.set(dedupeKey, candidate)
    } else {
      report.mergedDuplicates += 1
      // Keep latest form submission; append earlier notes
      if (candidate.timestampMs >= existing.timestampMs) {
        candidate.notes = `${candidate.notes}\n\n--- earlier duplicate ---\n${existing.notes}`
        merged.set(dedupeKey, candidate)
      } else {
        existing.notes = `${existing.notes}\n\n--- earlier duplicate ---\n${candidate.notes}`
      }
    }
  }

  let planned = [...merged.values()]
  if (args.limit && Number.isFinite(args.limit)) {
    planned = planned.slice(0, args.limit)
  }
  report.plannedRentals = planned.length
  report.sample = planned.slice(0, 12).map((row) => ({
    name: row.fullName,
    email: row.email,
    venues: row.venueKeys,
    startAt: row.startAt,
    endAt: row.endAt,
    endTimeDefaulted: row.endTimeDefaulted,
    rentalStatus: row.rentalStatus,
    sheetStatus: row.sheetStatus,
    importKey: row.importKey,
  }))

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const reportPath = resolve(outDir, "venue-rental-form-import-dry-run.json")

  if (!args.execute) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    console.log(`\nWrote ${reportPath}`)
    console.log("Dry-run only. Re-run with --execute to write to Supabase.")
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  ;(async () => {
    const { data: venues, error: venuesError } = await sb
      .from("venues")
      .select("id, name")
      .eq("organization_id", args.orgId)

    if (venuesError) throw new Error(venuesError.message)

    const venueByKey = new Map()
    for (const venue of venues || []) {
      const lower = String(venue.name || "").toLowerCase()
      if (lower.includes("banquet") && !venueByKey.has("banquet")) {
        venueByKey.set("banquet", venue)
      }
      if (lower.includes("youth") && !venueByKey.has("youth")) {
        venueByKey.set("youth", venue)
      }
    }

    if (!venueByKey.has("banquet") || !venueByKey.has("youth")) {
      throw new Error(
        `Need venues named like Banquet Hall and Youth Lounge in org. Found: ${(venues || [])
          .map((v) => v.name)
          .join(", ")}`
      )
    }

    // Contact group "Venue Rental"
    let groupId = null
    {
      const { data: existingGroup } = await sb
        .from("contacts")
        .select("id")
        .eq("organization_id", args.orgId)
        .eq("contact_type", "group")
        .ilike("full_name", GROUP_NAME)
        .maybeSingle()

      if (existingGroup?.id) {
        groupId = existingGroup.id
      } else {
        const { data: created, error } = await sb
          .from("contacts")
          .insert({
            organization_id: args.orgId,
            full_name: GROUP_NAME,
            contact_type: "group",
            status: "active",
          })
          .select("id")
          .single()
        if (error) throw new Error(`Create group: ${error.message}`)
        groupId = created.id
      }
    }

    const { data: existingRentals } = await sb
      .from("venue_rentals")
      .select("id, notes")
      .eq("organization_id", args.orgId)
      .ilike("notes", `%${IMPORT_TAG}%`)

    const importedKeys = new Set()
    for (const rental of existingRentals || []) {
      const match = String(rental.notes || "").match(
        /importKey=([a-f0-9]{24})/i
      )
      if (match) importedKeys.add(match[1])
      // Also hash-less: detect by import key embedded later
      const keyMatch = String(rental.notes || "").match(
        new RegExp(`${IMPORT_TAG}:([a-f0-9]{24})`)
      )
      if (keyMatch) importedKeys.add(keyMatch[1])
    }

    const { data: existingEventTypes } = await sb
      .from("venue_rental_event_types")
      .select("id, name, slug")
      .eq("organization_id", args.orgId)

    const eventTypeBySlug = new Map()
    const eventTypeByName = new Map()
    for (const type of existingEventTypes || []) {
      eventTypeBySlug.set(type.slug, type)
      eventTypeByName.set(type.name.toLowerCase(), type)
    }
    report.eventTypesCreated = 0

    for (const row of planned) {
      try {
        const venueResolve = resolveVenueIds(row.venueKeys, venueByKey)
        if (!venueResolve.ok) {
          report.skippedMissingVenueRecord += 1
          report.errors.push({
            name: row.fullName,
            error: `Missing venue key ${venueResolve.missing}`,
          })
          continue
        }

        const notesWithKey = `${row.notes}\n${IMPORT_TAG}:${row.importKey}`
        if (importedKeys.has(row.importKey)) {
          report.alreadyImported += 1
          continue
        }

        let venueRentalEventTypeId = null
        const canonicalType = row.eventType
          ? canonicalEventTypeName(row.eventType)
          : null
        if (canonicalType) {
          const beforeSlug = slugify(canonicalType) || "other"
          const hadType = eventTypeBySlug.has(beforeSlug)
          const eventType = await ensureEventType(
            sb,
            args.orgId,
            canonicalType,
            eventTypeBySlug,
            eventTypeByName
          )
          venueRentalEventTypeId = eventType.id
          if (!hadType) report.eventTypesCreated += 1
        }

        // Contact
        let contactId = null
        if (row.email || row.phoneDigits) {
          const { data: contactIdRpc, error: rpcError } = await sb.rpc(
            "find_or_create_contact_for_org",
            {
              p_organization_id: args.orgId,
              p_full_name: row.fullName,
              p_email: row.email,
              p_phone: row.phone,
              p_contact_type: "individual",
            }
          )
          if (rpcError || !contactIdRpc) {
            // Fallback insert
            const { data: created, error: insertError } = await sb
              .from("contacts")
              .insert({
                organization_id: args.orgId,
                full_name: row.fullName,
                email: row.email,
                phone: row.phone,
                contact_type: "individual",
                status: "active",
              })
              .select("id")
              .single()
            if (insertError) throw new Error(insertError.message)
            contactId = created.id
            report.contactsCreated += 1
          } else {
            contactId = contactIdRpc
            // Heuristic: treat as matched; RPC may create — count as matched for report simplicity
            report.contactsMatched += 1
          }
        } else {
          const { data: created, error: insertError } = await sb
            .from("contacts")
            .insert({
              organization_id: args.orgId,
              full_name: row.fullName,
              contact_type: "individual",
              status: "active",
            })
            .select("id")
            .single()
          if (insertError) throw new Error(insertError.message)
          contactId = created.id
          report.contactsCreated += 1
        }

        if (groupId && contactId) {
          const { error: memberError } = await sb
            .from("contact_group_members")
            .upsert(
              {
                organization_id: args.orgId,
                group_contact_id: groupId,
                member_contact_id: contactId,
                status: "active",
              },
              { onConflict: "group_contact_id,member_contact_id" }
            )
          if (!memberError) report.groupMemberships += 1
        }

        const rentalPayload = {
          organization_id: args.orgId,
          billing_contact_id: contactId,
          status: row.rentalStatus,
          notes: notesWithKey,
          expected_attendance: row.attendance,
          venue_rental_event_type_id: venueRentalEventTypeId,
          approved_at:
            row.rentalStatus === "approved_pending_payment" ||
            row.rentalStatus === "deposit_paid" ||
            row.rentalStatus === "confirmed" ||
            row.rentalStatus === "completed"
              ? row.startAt
              : null,
          closed_at: row.rentalStatus === "completed" ? row.endAt : null,
        }

        const { data: rental, error: rentalError } = await sb
          .from("venue_rentals")
          .insert(rentalPayload)
          .select("id")
          .single()

        if (rentalError || !rental) {
          throw new Error(rentalError?.message || "rental insert failed")
        }

        report.rentalsCreated += 1
        importedKeys.add(row.importKey)

        const reservationRows = venueResolve.ids.map((venueId) => ({
          organization_id: args.orgId,
          venue_rental_id: rental.id,
          venue_id: venueId,
          start_at: row.startAt,
          end_at: row.endAt,
          status: row.reservationStatus,
        }))

        const { error: reservationError } = await sb
          .from("rental_reservations")
          .insert(reservationRows)

        if (reservationError) {
          await sb.from("venue_rentals").delete().eq("id", rental.id)
          throw new Error(reservationError.message)
        }

        report.reservationsCreated += reservationRows.length
      } catch (error) {
        report.errors.push({
          name: row.fullName,
          email: row.email,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const executePath = resolve(outDir, "venue-rental-form-import-execute.json")
    writeFileSync(executePath, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    console.log(`\nWrote ${executePath}`)
  })().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

main()
