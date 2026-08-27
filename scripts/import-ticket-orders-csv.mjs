/**
 * Import Eventbrite TicketOrders.csv → Event Management (internal_events,
 * event_ticket_types, ticket_orders, tickets, contacts).
 *
 * Dry-run by default. Groups Eventbrite ticket lines into orders (Total paid
 * is the order total repeated on each line). Skips vendor/bazaar booth events,
 * current program years, and processing-fee rows. Attaches the Sep 12 2026
 * Crystal Banquet tickets to the existing Annual Fundraising Dinner.
 *
 *   node scripts/import-ticket-orders-csv.mjs
 *   node scripts/import-ticket-orders-csv.mjs --csv "C:/Users/danan/Downloads/TicketOrders.csv"
 *   node scripts/import-ticket-orders-csv.mjs --limit 50
 *   node scripts/import-ticket-orders-csv.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "TICKET_ORDERS_CSV_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "C:/Users/danan/Downloads/TicketOrders.csv"
const TZ = "America/Chicago"
const EXISTING_DINNER_DATE = "2026-09-12"
const BATCH = 80

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

function normalizeEmail(email) {
  return normalizeText(email).toLowerCase()
}

function normalizeNameKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function money(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function toCents(amount) {
  return Math.max(0, Math.round(amount * 100))
}

function importKey(parts) {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 20)
}

function pad(n) {
  return String(n).padStart(2, "0")
}

function chicagoParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

function wallTimeChicagoToIso(year, month, day, hour, minute) {
  for (const offsetHours of [5, 6]) {
    const utc = new Date(Date.UTC(year, month - 1, day, hour + offsetHours, minute, 0))
    const parts = chicagoParts(utc)
    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    ) {
      return utc.toISOString()
    }
  }
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute, 0)).toISOString()
}

function parseEventbriteDate(label) {
  const raw = normalizeText(label)
  const withTime = raw.match(
    /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  )
  const dateOnly = raw.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/i)
  const m = withTime || dateOnly
  if (!m) return { iso: null, date: null, year: null }
  const month = MONTHS[m[1].toLowerCase()]
  if (!month) return { iso: null, date: null, year: null }
  let hour = 12
  let minute = 0
  if (withTime) {
    hour = Number(m[4])
    minute = Number(m[5])
    const ampm = m[6].toUpperCase()
    if (ampm === "PM" && hour < 12) hour += 12
    if (ampm === "AM" && hour === 12) hour = 0
  }
  const year = Number(m[3])
  const day = Number(m[2])
  const iso = wallTimeChicagoToIso(year, month, day, hour, minute)
  return { iso, date: `${year}-${pad(month)}-${pad(day)}`, year }
}

function parseOrderDate(label) {
  const raw = normalizeText(label)
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return { iso: null, date: null }
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  return {
    iso: wallTimeChicagoToIso(year, month, day, 12, 0),
    date: `${year}-${pad(month)}-${pad(day)}`,
  }
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0], last_name: null }
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") }
}

function isVendorBazaarEvent(name) {
  const n = name.toLowerCase()
  if (n.includes("bazaar ticket")) return false
  return /bazaar|baazar|bazar|\bvendors?\b|booth/.test(n)
}

function isSkippedProgramEvent(name, eventYear) {
  const n = name.toLowerCase()
  if (/quran 4 little|quran for little|\bqlh\b/.test(n)) return "qlh"
  if (/quran institute/.test(n) && !/games/.test(n)) return "qil"
  if (/^mas sunday school$/.test(n) || n === "mas sunday school") return "sunday_school"
  if (eventYear === 2026 && /summer camp/.test(n) && !/meet/.test(n)) return "summer_camp_2026"
  return null
}

function skipReasonForEvent(name, eventYear) {
  if (isVendorBazaarEvent(name)) return "vendor_bazaar"
  const program = isSkippedProgramEvent(name, eventYear)
  if (program) return `program_${program}`
  return null
}

function isExistingDinner(name, eventDate) {
  return eventDate === EXISTING_DINNER_DATE && /annual fundraising dinner/i.test(name)
}

const DINNER_TYPE_ALIASES = {
  "kids program": "Takeoff Adventure Park (Kids 5-16)",
  babysitting: "Babysitting (Kids 1-4)",
}

function canonicalTicketTypeName(eventName, eventDate, csvName) {
  if (!isExistingDinner(eventName, eventDate)) return csvName
  return DINNER_TYPE_ALIASES[normalizeNameKey(csvName)] || csvName
}

function pickEventTypeName(name) {
  const n = name.toLowerCase()
  if (/fundrais|gala|dinner|dawah outreach|luncheon/.test(n)) return "Fundraiser"
  if (/workshop|class|coding|taekwondo|aerobic|fitness/.test(n)) return "Workshop"
  if (
    /iftar|eid|ramadan|hajj|itikaf|prayer|quran competition|isra|mi.?raj|taraweeh/.test(n)
  ) {
    return "Religious Program"
  }
  return "Community Event"
}

function pickDepartmentName(name) {
  const n = name.toLowerCase()
  if (/swim/.test(n)) return "Swimming"
  if (/camp|maspass|jannah infinity|avengers virtual/.test(n)) return "Recreational Camps"
  if (
    /youth|usar|all-nighter|qiyam|fashion|talent|mist|brothers|sisters|girls|boys|ipray|i pray|i-pray/.test(
      n
    )
  ) {
    return "Youth"
  }
  if (/quran|tadabbur|tafakkur|qlh/.test(n)) return "Education"
  return "Center"
}

function locationForEvent(name) {
  const n = name.toLowerCase()
  if (/virtual|online|zoom/.test(n)) {
    return { location_type: "online", location_label: "Online" }
  }
  return { location_type: "external", location_label: "MAS Dallas Islamic Center" }
}

function mapPaymentMethod(raw) {
  const v = normalizeText(raw).toUpperCase()
  if (v === "PAYPAL") return "paypal"
  if (v === "STRIPE") return "stripe"
  if (v === "NO_COST") return "comp"
  if (v === "OPERATOR") return "operator"
  return v.toLowerCase() || "imported"
}

function generateTicketCode(key, index) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const seed = createHash("sha256").update(`${key}:${index}`).digest()
  let code = "T"
  for (let i = 0; i < 7; i += 1) code += alphabet[seed[i] % alphabet.length]
  return code
}

function loadPlanned(csvPath, limit) {
  const text = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "")
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  const rows = parsed.data
  const skipped = {
    transaction_charge: 0,
    donation_lines: 0,
    vendor_bazaar: 0,
    program_qlh: 0,
    program_qil: 0,
    program_sunday_school: 0,
    program_summer_camp_2026: 0,
    missing_email: 0,
    unparsed_event_date: 0,
  }

  /** @type {Map<string, any>} */
  const events = new Map()
  /** @type {Map<string, any>} */
  const orderGroups = new Map()

  for (const row of rows) {
    const type = normalizeText(row.Type).toUpperCase()
    if (type === "TRANSACTION_CHARGE") {
      skipped.transaction_charge += 1
      continue
    }
    if (type === "DONATION") {
      skipped.donation_lines += 1
      continue
    }
    if (type !== "TICKET") continue

    const email = normalizeEmail(row.Email)
    if (!email) {
      skipped.missing_email += 1
      continue
    }

    const eventName = normalizeText(row["Event name"]) || "Untitled event"
    const eventParsed = parseEventbriteDate(row.Date)
    if (!eventParsed.date) {
      skipped.unparsed_event_date += 1
      continue
    }

    const reason = skipReasonForEvent(eventName, eventParsed.year)
    if (reason) {
      skipped[reason] = (skipped[reason] || 0) + 1
      continue
    }

    const paid = money(row["Total paid"])
    const method = mapPaymentMethod(row["Payment method"])
    const orderParsed = parseOrderDate(row["Order date"])
    const desc = canonicalTicketTypeName(
      eventName,
      eventParsed.date,
      normalizeText(row.Description) || "General Admission"
    )
    const purchaserName = normalizeText(row.Name) || email
    const attendeeName = normalizeText(row["Attendee name"]) || purchaserName
    const evKey = `${eventName}||${eventParsed.date}`

    if (!events.has(evKey)) {
      const loc = locationForEvent(eventName)
      const startIso = eventParsed.iso
      const endIso = startIso
        ? new Date(new Date(startIso).getTime() + 3 * 60 * 60 * 1000).toISOString()
        : null
      events.set(evKey, {
        eventKey: evKey,
        name: eventName,
        eventDate: eventParsed.date,
        startAt: startIso,
        endAt: endIso,
        year: eventParsed.year,
        attachExistingDinner: isExistingDinner(eventName, eventParsed.date),
        departmentName: pickDepartmentName(eventName),
        eventTypeName: pickEventTypeName(eventName),
        location_type: loc.location_type,
        location_label: loc.location_label,
        status: eventParsed.date < new Date().toISOString().slice(0, 10) ? "completed" : "approved",
        ticketRows: 0,
        ticketTypes: new Map(),
      })
    }
    const ev = events.get(evKey)
    ev.ticketRows += 1
    ev.ticketTypes.set(desc, (ev.ticketTypes.get(desc) || 0) + 1)

    const groupKey = [email, evKey, orderParsed.date || row["Order date"], String(paid), method].join("|")
    if (!orderGroups.has(groupKey)) {
      const names = splitName(purchaserName)
      orderGroups.set(groupKey, {
        importKey: importKey([IMPORT_TAG, email, evKey, orderParsed.date, String(paid), method]),
        eventKey: evKey,
        email,
        purchaserName,
        first_name: names.first_name,
        last_name: names.last_name,
        phone: normalizeText(row["Mobile number"]) || null,
        address_line1: normalizeText(row["Address 1"]) || null,
        city: normalizeText(row["Address 2"]) || null,
        state: normalizeText(row["Address 3"]) || null,
        postal_code: normalizeText(row["Postcode / Zip"]) || null,
        orderDate: orderParsed.date,
        orderAt: orderParsed.iso,
        paid,
        paidCents: toCents(paid),
        method,
        lines: [],
      })
    }
    orderGroups.get(groupKey).lines.push({
      ticketTypeName: desc,
      attendeeName,
      attendeeEmail: null,
    })
  }

  const typePrices = new Map()
  for (const order of orderGroups.values()) {
    const names = [...new Set(order.lines.map((l) => l.ticketTypeName))]
    if (names.length !== 1 || order.lines.length === 0) continue
    const unit = order.paid / order.lines.length
    const key = `${order.eventKey}||${names[0]}`
    const list = typePrices.get(key) || []
    list.push(unit)
    typePrices.set(key, list)
  }

  function inferredUnit(eventKey, typeName) {
    const list = typePrices.get(`${eventKey}||${typeName}`) || []
    if (list.length === 0) return null
    const counts = new Map()
    for (const n of list) {
      const cents = toCents(n)
      counts.set(cents, (counts.get(cents) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  let orders = [...orderGroups.values()].map((order) => {
    const lineCounts = new Map()
    for (const line of order.lines) {
      lineCounts.set(line.ticketTypeName, (lineCounts.get(line.ticketTypeName) || 0) + 1)
    }
    const types = [...lineCounts.entries()].map(([name, qty]) => ({
      name,
      qty,
      unitCents: inferredUnit(order.eventKey, name) ?? Math.round(order.paidCents / order.lines.length),
    }))
    return { ...order, types, ticketCount: order.lines.length }
  })

  if (limit && Number.isFinite(limit)) {
    orders = orders.slice(0, limit)
  }

  const usedEventKeys = new Set(orders.map((o) => o.eventKey))
  const eventList = [...events.values()]
    .filter((e) => usedEventKeys.has(e.eventKey))
    .sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)))

  for (const ev of eventList) {
    ev.ticketTypeList = [...ev.ticketTypes.entries()].map(([name, qty]) => ({
      name,
      qty,
      unitCents: inferredUnit(ev.eventKey, name) ?? 0,
    }))
  }

  const contacts = new Map()
  for (const order of orders) {
    const existing = contacts.get(order.email)
    contacts.set(order.email, {
      email: order.email,
      full_name: order.purchaserName,
      first_name: order.first_name,
      last_name: order.last_name,
      phone: order.phone || existing?.phone || null,
      address_line1: order.address_line1 || existing?.address_line1 || null,
      city: order.city || existing?.city || null,
      state: order.state || existing?.state || null,
      postal_code: order.postal_code || existing?.postal_code || null,
    })
  }

  return {
    csvRows: rows.length,
    skipped,
    events: eventList,
    orders,
    contacts: [...contacts.values()],
    parseErrors: parsed.errors.slice(0, 8),
  }
}

async function fetchAll(sb, table, columns, apply) {
  const pageSize = 1000
  let from = 0
  const rows = []
  for (;;) {
    let q = sb.from(table).select(columns).range(from, from + pageSize - 1)
    if (apply) q = apply(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function findOrCreateContact(sb, orgId, contact, counters) {
  const { data: contactIdRpc, error: rpcError } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: orgId,
    p_full_name: contact.full_name,
    p_email: contact.email,
    p_phone: contact.phone,
    p_contact_type: "individual",
  })

  let contactId = contactIdRpc
  if (rpcError || !contactId) {
    const { data: existing } = await sb
      .from("contacts")
      .select("id, phone, address_line1")
      .eq("organization_id", orgId)
      .ilike("email", contact.email)
      .eq("contact_type", "individual")
      .limit(1)
      .maybeSingle()
    if (existing?.id) {
      contactId = existing.id
      counters.contactsMatched += 1
    } else {
      const { data: created, error: insertError } = await sb
        .from("contacts")
        .insert({
          organization_id: orgId,
          full_name: contact.full_name,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          address_line1: contact.address_line1,
          city: contact.city,
          state: contact.state,
          postal_code: contact.postal_code,
          contact_type: "individual",
          status: "active",
        })
        .select("id")
        .single()
      if (insertError) throw new Error(`Create contact ${contact.email}: ${insertError.message}`)
      contactId = created.id
      counters.contactsCreated += 1
    }
  } else {
    counters.contactsMatched += 1
  }

  const patch = {}
  if (contact.phone) patch.phone = contact.phone
  if (contact.address_line1) patch.address_line1 = contact.address_line1
  if (contact.city) patch.city = contact.city
  if (contact.state) patch.state = contact.state
  if (contact.postal_code) patch.postal_code = contact.postal_code
  if (Object.keys(patch).length > 0) {
    const { data: current } = await sb
      .from("contacts")
      .select("phone, address_line1, city, state, postal_code")
      .eq("id", contactId)
      .maybeSingle()
    const fill = {}
    for (const [k, v] of Object.entries(patch)) {
      if (!normalizeText(current?.[k])) fill[k] = v
    }
    if (Object.keys(fill).length > 0) {
      await sb.from("contacts").update(fill).eq("id", contactId).eq("organization_id", orgId)
    }
  }

  return contactId
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  if (!existsSync(args.csv)) {
    console.error(`CSV not found: ${args.csv}`)
    process.exit(1)
  }

  const planned = loadPlanned(args.csv, args.limit)
  const ticketCents = planned.orders.reduce((sum, o) => sum + o.paidCents, 0)
  const ticketCount = planned.orders.reduce((sum, o) => sum + o.ticketCount, 0)

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    csv: args.csv,
    summary: {
      csv_rows: planned.csvRows,
      events: planned.events.length,
      orders: planned.orders.length,
      tickets: ticketCount,
      unique_contacts: planned.contacts.length,
      ticket_revenue_cents: ticketCents,
      ticket_revenue: Number((ticketCents / 100).toFixed(2)),
      skipped: planned.skipped,
      attach_existing_dinner: planned.events.filter((e) => e.attachExistingDinner).length,
    },
    events: planned.events.map((e) => ({
      name: e.name,
      date: e.eventDate,
      status: e.status,
      department: e.departmentName,
      eventType: e.eventTypeName,
      attachExistingDinner: e.attachExistingDinner,
      ticketRows: e.ticketRows,
      ticketTypes: e.ticketTypeList,
    })),
    sample_orders: planned.orders.slice(0, 12).map((o) => ({
      email: o.email,
      name: o.purchaserName,
      eventKey: o.eventKey,
      date: o.orderDate,
      paid: o.paid,
      tickets: o.ticketCount,
      types: o.types,
      importKey: o.importKey,
    })),
    counters: {
      eventsCreated: 0,
      eventsExisting: 0,
      ticketTypesCreated: 0,
      ticketTypesExisting: 0,
      contactsMatched: 0,
      contactsCreated: 0,
      ordersCreated: 0,
      ordersExisting: 0,
      ticketsCreated: 0,
      affiliationsSynced: 0,
    },
    errors: [],
    parseErrors: planned.parseErrors,
  }

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const reportPath = resolve(
    outDir,
    args.execute ? "ticket-orders-import-execute.json" : "ticket-orders-import-dry-run.json"
  )

  if (!args.execute) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    const summary = {
      ...report.summary,
      sample_events: report.events.slice(0, 8),
      dinner_event: report.events.filter((e) => e.attachExistingDinner),
    }
    console.log(JSON.stringify({ mode: "dry-run", summary, skipped: planned.skipped }, null, 2))
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

  const sb = createClient(url, key, { auth: { persistSession: false } })
  const orgId = args.orgId

  const departments = await fetchAll(sb, "departments", "id, name", (q) =>
    q.eq("organization_id", orgId)
  )
  const eventTypes = await fetchAll(sb, "event_types", "id, name", (q) =>
    q.eq("organization_id", orgId)
  )
  const deptByName = new Map(departments.map((d) => [d.name, d.id]))
  const typeByName = new Map(eventTypes.map((t) => [t.name, t.id]))
  const centerId = deptByName.get("Center")
  const communityTypeId = typeByName.get("Community Event")
  if (!centerId || !communityTypeId) {
    throw new Error("Missing Center department or Community Event type")
  }

  const existingEvents = await fetchAll(
    sb,
    "internal_events",
    "id, name, start_at, status",
    (q) => q.eq("organization_id", orgId)
  )
  const existingByNameDate = new Map()
  for (const ev of existingEvents) {
    const date = ev.start_at ? chicagoParts(new Date(ev.start_at)) : null
    const dateKey = date ? `${date.year}-${pad(date.month)}-${pad(date.day)}` : ""
    existingByNameDate.set(`${normalizeNameKey(ev.name)}||${dateKey}`, ev)
    if (dateKey === EXISTING_DINNER_DATE && /annual fundraising dinner/i.test(ev.name)) {
      existingByNameDate.set(`dinner||${dateKey}`, ev)
    }
  }

  const existingByKey = new Set()
  const taggedOrders = await fetchAll(
    sb,
    "ticket_orders",
    "id, metadata",
    (q) => q.eq("organization_id", orgId).contains("metadata", { importTag: IMPORT_TAG })
  )
  for (const row of taggedOrders) {
    const key = row.metadata?.importKey
    if (key) existingByKey.add(key)
  }

  const eventIdByKey = new Map()
  const typeIdByEventName = new Map()
  const soldByTypeId = new Map()

  for (const ev of planned.events) {
    let existing = null
    if (ev.attachExistingDinner) {
      existing = existingByNameDate.get(`dinner||${ev.eventDate}`)
    }
    if (!existing) {
      existing = existingByNameDate.get(`${normalizeNameKey(ev.name)}||${ev.eventDate}`)
    }

    let eventId
    if (existing?.id) {
      eventId = existing.id
      report.counters.eventsExisting += 1
      if (!ev.attachExistingDinner) {
        await sb
          .from("internal_events")
          .update({
            requires_ticketing: true,
            workspace_features: {
              registration: true,
              finance: true,
              staff: false,
              youth: false,
              vendors: false,
              waitlist: false,
            },
          })
          .eq("id", eventId)
          .eq("organization_id", orgId)
      }
    } else {
      const { data: created, error } = await sb
        .from("internal_events")
        .insert({
          organization_id: orgId,
          department_id: deptByName.get(ev.departmentName) || centerId,
          event_type_id: typeByName.get(ev.eventTypeName) || communityTypeId,
          name: ev.name,
          status: ev.status,
          start_at: ev.startAt,
          end_at: ev.endAt,
          timezone: TZ,
          location_type: ev.location_type,
          location_label: ev.location_label,
          requires_ticketing: true,
          community_calendar_status: "not_published",
          ticketing_config: {
            currency: "USD",
            salesStatus: ev.status === "completed" ? "sales_closed" : "published",
            attendanceMode: "paid",
          },
          workspace_features: {
            registration: true,
            finance: true,
            staff: false,
            youth: false,
            vendors: false,
            waitlist: false,
          },
          internal_notes: `Imported from TicketOrders.csv (${IMPORT_TAG})`,
          estimated_attendance: ev.ticketRows,
        })
        .select("id")
        .single()
      if (error) throw new Error(`Create event ${ev.name}: ${error.message}`)
      eventId = created.id
      report.counters.eventsCreated += 1
    }
    eventIdByKey.set(ev.eventKey, eventId)

    const existingTypes = await fetchAll(
      sb,
      "event_ticket_types",
      "id, name, price_cents, quantity_sold",
      (q) => q.eq("organization_id", orgId).eq("internal_event_id", eventId)
    )
    const typeByNorm = new Map(existingTypes.map((t) => [normalizeNameKey(t.name), t]))

    for (const [i, tt] of ev.ticketTypeList.entries()) {
      const norm = normalizeNameKey(tt.name)
      const found = typeByNorm.get(norm)
      if (found) {
        typeIdByEventName.set(`${eventId}||${tt.name}`, found.id)
        soldByTypeId.set(found.id, Number(found.quantity_sold || 0))
        report.counters.ticketTypesExisting += 1
        continue
      }
      const { data: createdType, error: typeError } = await sb
        .from("event_ticket_types")
        .insert({
          organization_id: orgId,
          internal_event_id: eventId,
          name: tt.name,
          price_cents: tt.unitCents,
          quantity_total: null,
          quantity_sold: 0,
          sort_order: i + 1,
          is_active: ev.status !== "completed",
          visibility: "public",
        })
        .select("id")
        .single()
      if (typeError) throw new Error(`Ticket type ${ev.name}/${tt.name}: ${typeError.message}`)
      typeIdByEventName.set(`${eventId}||${tt.name}`, createdType.id)
      soldByTypeId.set(createdType.id, 0)
      typeByNorm.set(norm, { id: createdType.id, name: tt.name })
      report.counters.ticketTypesCreated += 1
    }
  }

  const contactIdByEmail = new Map()
  let contactIndex = 0
  for (const contact of planned.contacts) {
    contactIndex += 1
    if (contactIndex % 200 === 0 || contactIndex === planned.contacts.length) {
      console.log(`Contacts ${contactIndex}/${planned.contacts.length}`)
    }
    const id = await findOrCreateContact(sb, orgId, contact, report.counters)
    contactIdByEmail.set(contact.email, id)
  }

  const ordersToInsert = []
  const ticketsToInsert = []
  const usedCodes = new Set()

  for (const order of planned.orders) {
    if (existingByKey.has(order.importKey)) {
      report.counters.ordersExisting += 1
      continue
    }
    const eventId = eventIdByKey.get(order.eventKey)
    const contactId = contactIdByEmail.get(order.email)
    if (!eventId || !contactId) {
      report.errors.push({ importKey: order.importKey, error: "missing event or contact" })
      continue
    }

    const orderId = randomUUID()
    ordersToInsert.push({
      id: orderId,
      organization_id: orgId,
      internal_event_id: eventId,
      contact_id: contactId,
      order_number: `TOV1-${order.importKey}`,
      status: "completed",
      subtotal_cents: order.paidCents,
      discount_cents: 0,
      total_cents: order.paidCents,
      currency: "USD",
      payment_method: order.method,
      payment_reference: order.importKey,
      purchaser_name: order.purchaserName,
      purchaser_email: order.email,
      billing_address: {
        line1: order.address_line1,
        city: order.city,
        state: order.state,
        postal_code: order.postal_code,
      },
      metadata: {
        importTag: IMPORT_TAG,
        importKey: order.importKey,
        source: "TicketOrders.csv",
      },
      created_at: order.orderAt || new Date().toISOString(),
    })

    let ticketIndex = 0
    for (const line of order.lines) {
      const typeId = typeIdByEventName.get(`${eventId}||${line.ticketTypeName}`)
      if (!typeId) {
        report.errors.push({
          importKey: order.importKey,
          error: `missing ticket type ${line.ticketTypeName}`,
        })
        continue
      }
      let code = generateTicketCode(order.importKey, ticketIndex)
      while (usedCodes.has(code)) {
        ticketIndex += 1
        code = generateTicketCode(order.importKey, ticketIndex)
      }
      usedCodes.add(code)
      ticketsToInsert.push({
        organization_id: orgId,
        ticket_order_id: orderId,
        ticket_type_id: typeId,
        internal_event_id: eventId,
        ticket_code: code,
        attendee_name: line.attendeeName,
        attendee_email: line.attendeeEmail,
        status: "valid",
        created_at: order.orderAt || new Date().toISOString(),
      })
      soldByTypeId.set(typeId, (soldByTypeId.get(typeId) || 0) + 1)
      ticketIndex += 1
    }
  }

  for (let i = 0; i < ordersToInsert.length; i += BATCH) {
    const chunk = ordersToInsert.slice(i, i + BATCH)
    const { error } = await sb.from("ticket_orders").insert(chunk)
    if (error) throw new Error(`Insert orders batch ${i}: ${error.message}`)
    report.counters.ordersCreated += chunk.length
    if ((i + BATCH) % 800 === 0 || i + BATCH >= ordersToInsert.length) {
      console.log(`Orders ${Math.min(i + BATCH, ordersToInsert.length)}/${ordersToInsert.length}`)
    }
  }

  for (let i = 0; i < ticketsToInsert.length; i += BATCH) {
    const chunk = ticketsToInsert.slice(i, i + BATCH)
    const { error } = await sb.from("tickets").insert(chunk)
    if (error) throw new Error(`Insert tickets batch ${i}: ${error.message}`)
    report.counters.ticketsCreated += chunk.length
    if ((i + BATCH) % 800 === 0 || i + BATCH >= ticketsToInsert.length) {
      console.log(`Tickets ${Math.min(i + BATCH, ticketsToInsert.length)}/${ticketsToInsert.length}`)
    }
  }

  for (const [typeId, sold] of soldByTypeId.entries()) {
    const { error } = await sb
      .from("event_ticket_types")
      .update({ quantity_sold: sold })
      .eq("id", typeId)
      .eq("organization_id", orgId)
    if (error) throw new Error(`Update sold ${typeId}: ${error.message}`)
  }

  const uniqueContactIds = [...new Set(contactIdByEmail.values())]
  let synced = 0
  for (const contactId of uniqueContactIds) {
    synced += 1
    if (synced % 200 === 0 || synced === uniqueContactIds.length) {
      console.log(`Affiliations ${synced}/${uniqueContactIds.length}`)
    }
    const { error } = await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: contactId,
    })
    if (!error) report.counters.affiliationsSynced += 1
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify(
      {
        mode: "execute",
        summary: report.summary,
        counters: report.counters,
        errorCount: report.errors.length,
        reportPath,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
