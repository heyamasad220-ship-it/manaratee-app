/**
 * Import the Sep 12 2026 Crystal Banquet fundraiser door report
 * (itemized TICKET + DONATION rows, check-in times, child names).
 *
 * Attaches to the existing Annual Fundraising Dinner. Updates the 12
 * TicketOrders.csv orders already on that event and inserts the rest.
 * Checkout donations are stored on ticket_orders.metadata.checkoutDonationCents.
 *
 *   node scripts/import-fundraiser-dinner-report.mjs
 *   node scripts/import-fundraiser-dinner-report.mjs --csv "C:/Users/danan/Downloads/September122026Fundraiser.csv"
 *   node scripts/import-fundraiser-dinner-report.mjs --execute
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

const IMPORT_TAG = "FUNDRAISER_DINNER_SEP2026_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_EVENT_ID = "412ba533-c63c-4c9f-8516-021897083501"
const DEFAULT_CSV = "C:/Users/danan/Downloads/September122026Fundraiser.csv"
const TZ = "America/Chicago"
const BATCH = 80

const TYPE_ALIASES = {
  "kids program": "Takeoff Adventure Park (Kids 5-16)",
  babysitting: "Babysitting (Kids 1-4)",
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
    eventId: DEFAULT_EVENT_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--csv") args.csv = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
    else if (arg === "--event-id") args.eventId = argv[++i]
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
    second: "2-digit",
    hourCycle: "h23",
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second || 0),
  }
}

function wallTimeChicagoToIso(year, month, day, hour, minute, second = 0) {
  for (const offsetHours of [5, 6]) {
    const utc = new Date(Date.UTC(year, month - 1, day, hour + offsetHours, minute, second))
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
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute, second)).toISOString()
}

function parseOrderDateTime(label) {
  const raw = normalizeText(label)
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!m) return { iso: null, date: null, stamp: raw }
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  const hour = m[4] != null ? Number(m[4]) : 12
  const minute = m[5] != null ? Number(m[5]) : 0
  return {
    iso: wallTimeChicagoToIso(year, month, day, hour, minute),
    date: `${year}-${pad(month)}-${pad(day)}`,
    stamp: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`,
  }
}

function parseCheckInTime(label) {
  const raw = normalizeText(label)
  const m = raw.match(
    /^[A-Za-z]{3},\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
  )
  if (!m) return null
  const months = {
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
  const month = months[m[2].toLowerCase()]
  if (!month) return null
  return wallTimeChicagoToIso(
    Number(m[3]),
    month,
    Number(m[1]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  )
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0], last_name: null }
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") }
}

function canonicalTicketTypeName(csvName) {
  const raw = normalizeText(csvName) || "General Admission"
  return TYPE_ALIASES[normalizeNameKey(raw)] || raw
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
  const seed = createHash("sha256").update(`${IMPORT_TAG}:${key}:${index}`).digest()
  let code = "F"
  for (let i = 0; i < 7; i += 1) code += alphabet[seed[i] % alphabet.length]
  return code
}

function loadPlanned(csvPath) {
  const text = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "")
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  const skipped = {
    unknown_type: 0,
    missing_email: 0,
    unparsed_order_date: 0,
  }
  /** @type {Map<string, any>} */
  const orderGroups = new Map()

  for (const row of parsed.data) {
    const type = normalizeText(row.Type).toUpperCase()
    if (type !== "TICKET" && type !== "DONATION") {
      skipped.unknown_type += 1
      continue
    }
    const email = normalizeEmail(row.Email)
    if (!email) {
      skipped.missing_email += 1
      continue
    }
    const orderParsed = parseOrderDateTime(row["Order date"])
    if (!orderParsed.date) {
      skipped.unparsed_order_date += 1
      continue
    }
    const method = mapPaymentMethod(row["Payment method"])
    const groupKey = [email, orderParsed.stamp, method].join("|")
    const purchaserName = normalizeText(row.Name) || email
    const attendeeName =
      normalizeText(row.Name_1) || normalizeText(row["Attendee name"]) || purchaserName
    const age = normalizeText(row.Age) || null
    const value = money(row.Value)

    if (!orderGroups.has(groupKey)) {
      const names = splitName(purchaserName)
      orderGroups.set(groupKey, {
        importKey: importKey([IMPORT_TAG, email, orderParsed.stamp, method]),
        email,
        purchaserName,
        first_name: names.first_name,
        last_name: names.last_name,
        phone: normalizeText(row["Mobile number"]) || null,
        orderDate: orderParsed.date,
        orderStamp: orderParsed.stamp,
        orderAt: orderParsed.iso,
        method,
        ticketCents: 0,
        donationCents: 0,
        lines: [],
      })
    }
    const order = orderGroups.get(groupKey)
    if (!order.phone) order.phone = normalizeText(row["Mobile number"]) || null
    if (type === "DONATION") {
      order.donationCents += toCents(value)
      continue
    }
    order.ticketCents += toCents(value)
    order.lines.push({
      ticketTypeName: canonicalTicketTypeName(row.Description),
      attendeeName,
      age,
      checkedIn: normalizeText(row["Checked in"]).toLowerCase() === "yes",
      checkInAt: parseCheckInTime(row["First check-in time"]),
      checkInUser: normalizeText(row["First check-in user"]) || null,
    })
  }

  const orders = [...orderGroups.values()].map((order) => ({
    ...order,
    paidCents: order.ticketCents + order.donationCents,
    ticketCount: order.lines.length,
  }))

  const contacts = new Map()
  for (const order of orders) {
    const existing = contacts.get(order.email)
    contacts.set(order.email, {
      email: order.email,
      full_name: order.purchaserName,
      first_name: order.first_name,
      last_name: order.last_name,
      phone: order.phone || existing?.phone || null,
    })
  }

  return {
    csvRows: parsed.data.length,
    skipped,
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
      .select("id")
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

  if (contact.phone) {
    const { data: current } = await sb
      .from("contacts")
      .select("phone")
      .eq("id", contactId)
      .maybeSingle()
    if (!normalizeText(current?.phone)) {
      await sb
        .from("contacts")
        .update({ phone: contact.phone })
        .eq("id", contactId)
        .eq("organization_id", orgId)
    }
  }

  return contactId
}

function matchExistingOrder(order, existingByEmailDate) {
  const sameDay = existingByEmailDate.get(`${order.email}|${order.orderDate}`) || []
  if (sameDay.length === 1) return sameDay[0]
  if (sameDay.length > 1) {
    const byCount = sameDay.filter((row) => Number(row.ticket_count) === order.ticketCount)
    if (byCount.length === 1) return byCount[0]
  }
  return null
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  if (!existsSync(args.csv)) {
    console.error(`CSV not found: ${args.csv}`)
    process.exit(1)
  }

  const planned = loadPlanned(args.csv)
  const ticketCount = planned.orders.reduce((sum, o) => sum + o.ticketCount, 0)
  const ticketCents = planned.orders.reduce((sum, o) => sum + o.ticketCents, 0)
  const donationCents = planned.orders.reduce((sum, o) => sum + o.donationCents, 0)
  const checkedIn = planned.orders.reduce(
    (sum, o) => sum + o.lines.filter((line) => line.checkedIn).length,
    0
  )

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    eventId: args.eventId,
    csv: args.csv,
    summary: {
      csv_rows: planned.csvRows,
      orders: planned.orders.length,
      tickets: ticketCount,
      unique_contacts: planned.contacts.length,
      ticket_revenue: Number((ticketCents / 100).toFixed(2)),
      ticket_donations: Number((donationCents / 100).toFixed(2)),
      checked_in: checkedIn,
      skipped: planned.skipped,
    },
    sample_orders: planned.orders.slice(0, 8).map((o) => ({
      email: o.email,
      name: o.purchaserName,
      date: o.orderStamp,
      tickets: o.ticketCount,
      ticketCents: o.ticketCents,
      donationCents: o.donationCents,
      importKey: o.importKey,
    })),
    counters: {
      contactsMatched: 0,
      contactsCreated: 0,
      ordersCreated: 0,
      ordersUpdated: 0,
      ordersExisting: 0,
      ticketsCreated: 0,
      ticketsUpdated: 0,
      affiliationsSynced: 0,
    },
    errors: [],
    parseErrors: planned.parseErrors,
  }

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const reportPath = resolve(
    outDir,
    args.execute
      ? "fundraiser-dinner-sep2026-execute.json"
      : "fundraiser-dinner-sep2026-dry-run.json"
  )

  if (!args.execute) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ mode: "dry-run", summary: report.summary }, null, 2))
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
  const eventId = args.eventId

  const types = await fetchAll(
    sb,
    "event_ticket_types",
    "id, name, quantity_sold",
    (q) => q.eq("organization_id", orgId).eq("internal_event_id", eventId)
  )
  const typeIdByName = new Map(types.map((t) => [normalizeNameKey(t.name), t.id]))
  for (const alias of Object.values(TYPE_ALIASES)) {
    const id = typeIdByName.get(normalizeNameKey(alias))
    if (id) {
      if (alias.includes("Kids 5")) typeIdByName.set("kids program", id)
      if (alias.includes("Kids 1")) typeIdByName.set("babysitting", id)
    }
  }
  if (!typeIdByName.get("general admission")) {
    throw new Error("Dinner ticket types not found on event")
  }

  const existingOrders = await fetchAll(
    sb,
    "ticket_orders",
    "id, purchaser_email, total_cents, subtotal_cents, metadata, created_at, payment_method",
    (q) => q.eq("organization_id", orgId).eq("internal_event_id", eventId)
  )
  const existingTickets = await fetchAll(
    sb,
    "tickets",
    "id, ticket_order_id, ticket_type_id, ticket_code, attendee_name, status, checked_in_at",
    (q) => q.eq("organization_id", orgId).eq("internal_event_id", eventId)
  )
  const ticketsByOrder = new Map()
  for (const ticket of existingTickets) {
    const list = ticketsByOrder.get(ticket.ticket_order_id) || []
    list.push(ticket)
    ticketsByOrder.set(ticket.ticket_order_id, list)
  }

  const existingByKey = new Map()
  const existingByEmailDate = new Map()
  for (const row of existingOrders) {
    const metaKey = row.metadata?.importKey
    if (metaKey) existingByKey.set(metaKey, row)
    const email = normalizeEmail(row.purchaser_email)
    const date = row.created_at ? chicagoParts(new Date(row.created_at)) : null
    const dateKey = date ? `${date.year}-${pad(date.month)}-${pad(date.day)}` : ""
    const key = `${email}|${dateKey}`
    const list = existingByEmailDate.get(key) || []
    list.push({
      ...row,
      ticket_count: (ticketsByOrder.get(row.id) || []).length,
    })
    existingByEmailDate.set(key, list)
  }

  const usedCodes = new Set(existingTickets.map((t) => t.ticket_code))
  const contactIdByEmail = new Map()
  let contactIndex = 0
  for (const contact of planned.contacts) {
    contactIndex += 1
    if (contactIndex % 50 === 0 || contactIndex === planned.contacts.length) {
      console.log(`Contacts ${contactIndex}/${planned.contacts.length}`)
    }
    const id = await findOrCreateContact(sb, orgId, contact, report.counters)
    contactIdByEmail.set(contact.email, id)
  }

  const ordersToInsert = []
  const ticketsToInsert = []
  const ticketUpdates = []
  const orderUpdates = []
  const newContactIds = new Set()

  for (const order of planned.orders) {
    const matched =
      existingByKey.get(order.importKey) || matchExistingOrder(order, existingByEmailDate)
    const contactId = contactIdByEmail.get(order.email)
    if (!contactId) {
      report.errors.push({ importKey: order.importKey, error: "missing contact" })
      continue
    }

    const donationMeta = {
      importTag: IMPORT_TAG,
      importKey: order.importKey,
      source: "September122026Fundraiser.csv",
      checkoutDonationCents: order.donationCents,
      ticketSubtotalCents: order.ticketCents,
    }

    if (matched?.id) {
      const prevMeta = matched.metadata && typeof matched.metadata === "object" ? matched.metadata : {}
      if (prevMeta.importTag === IMPORT_TAG && prevMeta.ticketsSynced === true) {
        report.counters.ordersExisting += 1
        continue
      }
      orderUpdates.push({
        id: matched.id,
        patch: {
          metadata: {
            ...prevMeta,
            ...donationMeta,
            previousImportKey: prevMeta.importKey || null,
            ticketsSynced: true,
          },
        },
      })
      const existing = [...(ticketsByOrder.get(matched.id) || [])]
      const unmatched = existing.map((ticket) => ({
        ...ticket,
        typeKey: [...typeIdByName.entries()].find(([, id]) => id === ticket.ticket_type_id)?.[0],
      }))
      for (const line of order.lines) {
        const typeId = typeIdByName.get(normalizeNameKey(line.ticketTypeName))
        if (!typeId) {
          report.errors.push({
            importKey: order.importKey,
            error: `missing ticket type ${line.ticketTypeName}`,
          })
          continue
        }
        const idx = unmatched.findIndex((ticket) => ticket.ticket_type_id === typeId)
        const patch = {
          attendee_name: line.attendeeName,
          status: line.checkedIn ? "checked_in" : "valid",
          checked_in_at: line.checkedIn ? line.checkInAt : null,
        }
        if (idx >= 0) {
          const ticket = unmatched.splice(idx, 1)[0]
          ticketUpdates.push({ id: ticket.id, ...patch })
          report.counters.ticketsUpdated += 1
        } else {
          let ticketIndex = ticketsToInsert.length
          let code = generateTicketCode(order.importKey, ticketIndex)
          while (usedCodes.has(code)) {
            ticketIndex += 1
            code = generateTicketCode(order.importKey, ticketIndex)
          }
          usedCodes.add(code)
          ticketsToInsert.push({
            organization_id: orgId,
            ticket_order_id: matched.id,
            ticket_type_id: typeId,
            internal_event_id: eventId,
            ticket_code: code,
            attendee_name: line.attendeeName,
            attendee_email: null,
            status: line.checkedIn ? "checked_in" : "valid",
            checked_in_at: line.checkedIn ? line.checkInAt : null,
            created_at: order.orderAt || new Date().toISOString(),
          })
        }
      }
      report.counters.ordersUpdated += 1
      continue
    }

    const orderId = randomUUID()
    ordersToInsert.push({
      id: orderId,
      organization_id: orgId,
      internal_event_id: eventId,
      contact_id: contactId,
      order_number: `FD26-${order.importKey}`,
      status: "completed",
      subtotal_cents: order.ticketCents,
      discount_cents: 0,
      total_cents: order.paidCents,
      currency: "USD",
      payment_method: order.method,
      payment_reference: order.importKey,
      purchaser_name: order.purchaserName,
      purchaser_email: order.email,
      metadata: { ...donationMeta, ticketsSynced: true },
      created_at: order.orderAt || new Date().toISOString(),
    })
    newContactIds.add(contactId)

    let ticketIndex = 0
    for (const line of order.lines) {
      const typeId = typeIdByName.get(normalizeNameKey(line.ticketTypeName))
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
        attendee_email: null,
        status: line.checkedIn ? "checked_in" : "valid",
        checked_in_at: line.checkedIn ? line.checkInAt : null,
        created_at: order.orderAt || new Date().toISOString(),
      })
      ticketIndex += 1
    }
  }

  for (let i = 0; i < ordersToInsert.length; i += BATCH) {
    const chunk = ordersToInsert.slice(i, i + BATCH)
    const { error } = await sb.from("ticket_orders").insert(chunk)
    if (error) throw new Error(`Insert orders batch ${i}: ${error.message}`)
    report.counters.ordersCreated += chunk.length
  }

  for (const update of orderUpdates) {
    const { error } = await sb
      .from("ticket_orders")
      .update(update.patch)
      .eq("id", update.id)
      .eq("organization_id", orgId)
    if (error) throw new Error(`Update order ${update.id}: ${error.message}`)
  }

  for (let i = 0; i < ticketsToInsert.length; i += BATCH) {
    const chunk = ticketsToInsert.slice(i, i + BATCH)
    const { error } = await sb.from("tickets").insert(chunk)
    if (error) throw new Error(`Insert tickets batch ${i}: ${error.message}`)
    report.counters.ticketsCreated += chunk.length
  }

  for (let i = 0; i < ticketUpdates.length; i += BATCH) {
    const chunk = ticketUpdates.slice(i, i + BATCH)
    for (const ticket of chunk) {
      const { id, ...patch } = ticket
      const { error } = await sb
        .from("tickets")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", orgId)
      if (error) throw new Error(`Update ticket ${id}: ${error.message}`)
    }
  }

  const liveTickets = await fetchAll(
    sb,
    "tickets",
    "ticket_type_id, status",
    (q) => q.eq("organization_id", orgId).eq("internal_event_id", eventId)
  )
  const soldByType = new Map()
  for (const ticket of liveTickets) {
    if (ticket.status === "canceled" || ticket.status === "refunded") continue
    soldByType.set(ticket.ticket_type_id, (soldByType.get(ticket.ticket_type_id) || 0) + 1)
  }
  for (const type of types) {
    const { error } = await sb
      .from("event_ticket_types")
      .update({ quantity_sold: soldByType.get(type.id) || 0 })
      .eq("id", type.id)
      .eq("organization_id", orgId)
    if (error) throw new Error(`Update sold ${type.id}: ${error.message}`)
  }

  let synced = 0
  const toSync = [...newContactIds]
  for (const contactId of toSync) {
    synced += 1
    const { error } = await sb.rpc("sync_contact_affiliations", {
      p_organization_id: orgId,
      p_contact_id: contactId,
    })
    if (!error) report.counters.affiliationsSynced += 1
    if (synced % 50 === 0 || synced === toSync.length) {
      console.log(`Affiliations ${synced}/${toSync.length}`)
    }
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
