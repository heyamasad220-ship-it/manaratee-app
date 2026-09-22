/**
 * Import FallBazaar101026.csv → MAS Fall Bazaar (Oct 10, 2026).
 *
 * Creates/updates:
 * - internal_events (Event Management source of truth)
 * - vendor_hub_events (bazaar workspace)
 * - vendor_hub_booth_types + vendor_hub_booths (one assigned booth per CSV row)
 * - contacts + approved vendor applications + vendor role
 * - vendor_hub_participant_status (paid)
 * - vendor_hub_booth_assignments + vendor_hub_payments
 *
 * These Eventbrite "TICKET" rows are booth purchases, not Event Management tickets.
 *
 * Usage:
 *   node scripts/import-fall-bazaar-101026.mjs
 *   node scripts/import-fall-bazaar-101026.mjs --csv "C:/Users/danan/Downloads/FallBazaar101026.csv"
 *   node scripts/import-fall-bazaar-101026.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "FALL_BAZAAR_101026_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "C:/Users/danan/Downloads/FallBazaar101026.csv"
const EVENT_NAME = "MAS Fall Bazaar"
const EVENT_DATE = "2026-10-10"
const START_TIME = "11:00:00"
const END_TIME = "19:00:00"
const LOCATION = "MAS Dallas Islamic Center"
const DEPARTMENT_ID = "06c1c886-8575-4c89-82d9-0892a65364ad"
const EVENT_TYPE_ID = "db4522b0-3550-4d7a-bbeb-a043b3f9e6d5"
const CONSUMER_EMAIL_DOMAINS = /^(gmail|yahoo|outlook|hotmail|icloud|aol|me)\./i

const BOOTH_TYPE_META = {
  "Regular Booth - Main Prayer Hall": {
    prefix: "MPH",
    location: "Main Prayer Hall",
    color: "#2563eb",
    sort_order: 0,
  },
  "Corner Booth - Main Prayer Hall": {
    prefix: "CRN",
    location: "Main Prayer Hall",
    color: "#7c3aed",
    sort_order: 1,
  },
  "Booth on the stage": {
    prefix: "STG",
    location: "Main Prayer Hall (stage)",
    color: "#0891b2",
    sort_order: 2,
  },
  "Booth in the entrance (Lobby)": {
    prefix: "LBY",
    location: "Main Lobby",
    color: "#d97706",
    sort_order: 3,
  },
  Coffee: {
    prefix: "COFF",
    location: "Outside",
    color: "#92400e",
    sort_order: 4,
  },
  "Mocktail/ Smoothie (outside)": {
    prefix: "SMTH",
    location: "Outside",
    color: "#059669",
    sort_order: 5,
  },
  "Food Vendors between the two buildings (Hot Meal)": {
    prefix: "FOOD",
    location: "Between the two buildings",
    color: "#dc2626",
    sort_order: 6,
  },
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
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--csv") args.csv = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeEmail(email) {
  return normalizeText(email).toLowerCase()
}

function importKey(parts) {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 24)
}

function parseCSV(text) {
  const rows = []
  let row = []
  let cur = ""
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const n = text[i + 1]
    if (q) {
      if (c === '"' && n === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        q = false
      } else {
        cur += c
      }
    } else if (c === '"') {
      q = true
    } else if (c === ",") {
      row.push(cur)
      cur = ""
    } else if (c === "\n" || (c === "\r" && n === "\n")) {
      if (c === "\r") i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ""
    } else if (c !== "\r") {
      cur += c
    }
  }
  if (cur.length || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

function parsePaymentDate(orderDate) {
  const raw = normalizeText(orderDate)
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const month = match[1].padStart(2, "0")
  const day = match[2].padStart(2, "0")
  return `${match[3]}-${month}-${day}`
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0], last_name: null }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

function titleCase(value) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function inferBusinessName(fullName, email) {
  const domain = (email.split("@")[1] || "").toLowerCase()
  if (domain && !CONSUMER_EMAIL_DOMAINS.test(domain)) {
    const brand = domain.split(".")[0]
    if (brand) return titleCase(brand)
  }
  return fullName
}

function boothTypeMeta(category) {
  return (
    BOOTH_TYPE_META[category] || {
      prefix: "BTH",
      location: null,
      color: "#2563eb",
      sort_order: 99,
    }
  )
}

function loadPlannedRows(csvPath) {
  const raw = readFileSync(csvPath, "utf8")
  const table = parseCSV(raw.replace(/^\uFEFF/, ""))
  const header = table[0]
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  const data = table.slice(1).filter((r) => r.some((c) => String(c).trim()))

  const contactsByEmail = new Map()
  const orders = []
  const skipped = []

  for (const row of data) {
    const get = (name) => normalizeText(row[idx[name]])
    const email = normalizeEmail(get("Email"))
    const eventName = get("Event name") || EVENT_NAME
    const boothCategory = get("Description")
    const amount = Number(get("Value") || 0)
    const orderDate = get("Order date")
    const paymentMethod = get("Payment method")
    const fullName = get("Name")
    const phone = get("Mobile number")
    const type = get("Type")

    if (type && type.toUpperCase() !== "TICKET") {
      skipped.push({ reason: `type=${type}`, email, boothCategory })
      continue
    }
    if (!email) {
      skipped.push({ reason: "no_email", boothCategory })
      continue
    }

    const names = splitName(fullName)
    const businessName = inferBusinessName(fullName, email)
    const paymentDate = parsePaymentDate(orderDate)
    const key = importKey([
      IMPORT_TAG,
      email,
      EVENT_DATE,
      String(Number.isFinite(amount) ? amount : 0),
      orderDate,
      paymentMethod,
      boothCategory,
    ])

    const existing = contactsByEmail.get(email)
    contactsByEmail.set(email, {
      email,
      first_name: names.first_name || existing?.first_name || null,
      last_name: names.last_name || existing?.last_name || null,
      full_name: fullName || existing?.full_name || email,
      phone: phone || existing?.phone || null,
      company_name: businessName || existing?.company_name || fullName,
      latest_activity_date: paymentDate || EVENT_DATE,
      earliest_activity_date:
        existing?.earliest_activity_date && paymentDate
          ? paymentDate < existing.earliest_activity_date
            ? paymentDate
            : existing.earliest_activity_date
          : paymentDate || EVENT_DATE,
    })

    orders.push({
      importKey: key,
      email,
      contactName: fullName,
      companyName: businessName,
      boothCategory,
      feeAmount: Number.isFinite(amount) ? amount : 0,
      paymentMethod: paymentMethod || "imported",
      paidAt: orderDate,
      paymentDate: paymentDate || EVENT_DATE,
      eventName,
    })
  }

  const typeCounts = new Map()
  for (const order of orders) {
    const current = typeCounts.get(order.boothCategory) || {
      name: order.boothCategory,
      price: order.feeAmount,
      count: 0,
      ...boothTypeMeta(order.boothCategory),
    }
    current.count += 1
    current.price = order.feeAmount
    typeCounts.set(order.boothCategory, current)
  }

  const typeSeq = new Map()
  for (const order of orders) {
    const next = (typeSeq.get(order.boothCategory) || 0) + 1
    typeSeq.set(order.boothCategory, next)
    const meta = boothTypeMeta(order.boothCategory)
    order.boothNumber = `${meta.prefix}-${String(next).padStart(2, "0")}`
    order.boothLocation = meta.location
  }

  return {
    csvRows: data.length,
    skipped,
    contacts: [...contactsByEmail.values()].sort((a, b) => a.email.localeCompare(b.email)),
    orders,
    boothTypes: [...typeCounts.values()].sort((a, b) => a.sort_order - b.sort_order),
    totalRevenue: orders.reduce((sum, row) => sum + row.feeAmount, 0),
  }
}

async function findOrCreateContact(sb, orgId, contact, counters) {
  const { data: contactIdRpc, error: rpcError } = await sb.rpc(
    "find_or_create_contact_for_org",
    {
      p_organization_id: orgId,
      p_full_name: contact.full_name,
      p_email: contact.email,
      p_phone: contact.phone,
      p_contact_type: "individual",
    }
  )

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
          company_name: contact.company_name,
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

  const patch = {
    first_name: contact.first_name,
    last_name: contact.last_name,
    company_name: contact.company_name,
    phone: contact.phone,
    last_activity_at: `${contact.latest_activity_date}T12:00:00.000Z`,
  }
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v != null && String(v).trim() !== "")
  )
  if (Object.keys(cleanPatch).length > 0) {
    await sb.from("contacts").update(cleanPatch).eq("id", contactId).eq("organization_id", orgId)
  }

  return contactId
}

async function ensureVendorApplication(sb, orgId, contactId, contact, counters) {
  const { data: existing } = await sb
    .from("applications")
    .select("id, status, notes, submitted_at, form_data")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("application_type", "vendor")
    .eq("module_owner", "vendor_hub")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const activityAt = `${contact.earliest_activity_date}T12:00:00.000Z`
  const formData = {
    ...((existing?.form_data && typeof existing.form_data === "object"
      ? existing.form_data
      : {})),
    business_name: contact.company_name,
  }

  if (existing?.id) {
    await sb
      .from("applications")
      .update({
        status: "approved",
        submitted_at: existing.submitted_at || activityAt,
        applicant_name: contact.full_name,
        applicant_email: contact.email,
        applicant_phone: contact.phone,
        form_data: formData,
      })
      .eq("id", existing.id)
    if (existing.status !== "approved") counters.applicationsApproved += 1
    else counters.applicationsExisting += 1
    return existing.id
  }

  const { data: created, error } = await sb
    .from("applications")
    .insert({
      organization_id: orgId,
      application_type: "vendor",
      module_owner: "vendor_hub",
      contact_id: contactId,
      applicant_name: contact.full_name,
      applicant_email: contact.email,
      applicant_phone: contact.phone,
      status: "approved",
      submitted_at: activityAt,
      form_data: formData,
      notes: `Imported from FallBazaar101026.csv (${IMPORT_TAG})`,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Create application ${contact.email}: ${error.message}`)
  counters.applicationsCreated += 1
  return created.id
}

async function ensureVendorRole(sb, orgId, contactId) {
  const { data: existing } = await sb
    .from("contact_roles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("role", "vendor")
    .maybeSingle()

  if (existing?.id) return
  const { error } = await sb.from("contact_roles").insert({
    organization_id: orgId,
    contact_id: contactId,
    role: "vendor",
  })
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message)
  }
}

async function ensureInternalEvent(sb, orgId, counters) {
  const { data: existingBazaar } = await sb
    .from("vendor_hub_events")
    .select("id, internal_event_id")
    .eq("organization_id", orgId)
    .eq("name", EVENT_NAME)
    .eq("event_date", EVENT_DATE)
    .maybeSingle()

  if (existingBazaar?.internal_event_id) {
    counters.internalEventsExisting += 1
    return {
      bazaarId: existingBazaar.id,
      internalEventId: existingBazaar.internal_event_id,
    }
  }

  const { data: existingInternal } = await sb
    .from("internal_events")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", EVENT_NAME)
    .gte("start_at", `${EVENT_DATE}T00:00:00-05:00`)
    .lt("start_at", `2026-10-11T00:00:00-05:00`)
    .maybeSingle()

  if (existingInternal?.id) {
    counters.internalEventsExisting += 1
    return { bazaarId: existingBazaar?.id || null, internalEventId: existingInternal.id }
  }

  const { data: created, error } = await sb
    .from("internal_events")
    .insert({
      organization_id: orgId,
      department_id: DEPARTMENT_ID,
      event_type_id: EVENT_TYPE_ID,
      name: EVENT_NAME,
      description: `Imported from FallBazaar101026.csv (${IMPORT_TAG}). Booth purchases from Eventbrite.`,
      status: "confirmed",
      start_at: `${EVENT_DATE}T11:00:00-05:00`,
      end_at: `${EVENT_DATE}T19:00:00-05:00`,
      location_type: "external",
      location_label: LOCATION,
      community_calendar_status: "not_published",
      requires_vendors: true,
      workspace_features: { vendors: true },
      timezone: "America/Chicago",
    })
    .select("id")
    .single()

  if (error || !created?.id) {
    throw new Error(error?.message || "Failed to create Event Management event")
  }
  counters.internalEventsCreated += 1
  return { bazaarId: existingBazaar?.id || null, internalEventId: created.id }
}

async function ensureBazaarEvent(sb, orgId, internalEventId, existingBazaarId, totalBooths, counters) {
  if (existingBazaarId) {
    await sb
      .from("vendor_hub_events")
      .update({
        start_time: START_TIME,
        end_time: END_TIME,
        location: LOCATION,
        status: "published",
        total_booths: totalBooths,
        internal_event_id: internalEventId,
      })
      .eq("id", existingBazaarId)
      .eq("organization_id", orgId)
    counters.eventsExisting += 1
    return existingBazaarId
  }

  const { data: created, error } = await sb
    .from("vendor_hub_events")
    .insert({
      organization_id: orgId,
      name: EVENT_NAME,
      event_type: "bazaar",
      event_date: EVENT_DATE,
      start_time: START_TIME,
      end_time: END_TIME,
      location: LOCATION,
      status: "published",
      calendar_status: "not_published",
      description: `Imported from FallBazaar101026.csv (${IMPORT_TAG})`,
      expected_attendees: 0,
      total_booths: totalBooths,
      internal_event_id: internalEventId,
      public_share_token: randomUUID().replace(/-/g, ""),
    })
    .select("id")
    .single()

  if (error || !created?.id) {
    throw new Error(error?.message || "Failed to create bazaar event")
  }
  counters.eventsCreated += 1
  return created.id
}

async function ensureBoothTypes(sb, orgId, eventId, boothTypes, counters) {
  const idByName = new Map()
  const { data: existing } = await sb
    .from("vendor_hub_booth_types")
    .select("id, name")
    .eq("event_id", eventId)

  for (const row of existing || []) {
    idByName.set(row.name, row.id)
  }

  for (const type of boothTypes) {
    if (idByName.has(type.name)) {
      await sb
        .from("vendor_hub_booth_types")
        .update({
          price: type.price,
          location: type.location,
          color: type.color,
          capacity: type.count,
          is_active: true,
          sort_order: type.sort_order,
          organization_id: orgId,
        })
        .eq("id", idByName.get(type.name))
      counters.boothTypesExisting += 1
      continue
    }

    const { data: created, error } = await sb
      .from("vendor_hub_booth_types")
      .insert({
        event_id: eventId,
        organization_id: orgId,
        name: type.name,
        price: type.price,
        location: type.location,
        color: type.color,
        capacity: type.count,
        is_active: true,
        sort_order: type.sort_order,
        description: `Imported booth type (${IMPORT_TAG})`,
      })
      .select("id")
      .single()
    if (error || !created?.id) {
      throw new Error(error?.message || `Failed to create booth type ${type.name}`)
    }
    idByName.set(type.name, created.id)
    counters.boothTypesCreated += 1
  }

  return idByName
}

async function ensureBooth(sb, eventId, typeId, order, counters) {
  const { data: existing } = await sb
    .from("vendor_hub_booths")
    .select("id")
    .eq("event_id", eventId)
    .eq("number", order.boothNumber)
    .maybeSingle()

  if (existing?.id) {
    await sb
      .from("vendor_hub_booths")
      .update({
        booth_type_id: typeId,
        location: order.boothLocation,
        status: "assigned",
        vendor_name: order.companyName,
        notes: `${IMPORT_TAG}:importKey=${order.importKey}`,
      })
      .eq("id", existing.id)
    counters.boothsExisting += 1
    return existing.id
  }

  const { data: created, error } = await sb
    .from("vendor_hub_booths")
    .insert({
      event_id: eventId,
      booth_type_id: typeId,
      number: order.boothNumber,
      location: order.boothLocation,
      status: "assigned",
      vendor_name: order.companyName,
      notes: `${IMPORT_TAG}:importKey=${order.importKey}`,
    })
    .select("id")
    .single()
  if (error || !created?.id) {
    throw new Error(error?.message || `Failed to create booth ${order.boothNumber}`)
  }
  counters.boothsCreated += 1
  return created.id
}

async function ensureParticipant(sb, orgId, eventId, contactId, applicationId, order, counters) {
  const notes = [
    IMPORT_TAG,
    `importKey=${order.importKey}`,
    `category=${order.boothCategory}`,
    `booth=${order.boothNumber}`,
  ].join("\n")

  const { data: existing } = await sb
    .from("vendor_hub_participant_status")
    .select("id, notes")
    .eq("organization_id", orgId)
    .eq("vendor_hub_event_id", eventId)
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    if (String(existing.notes || "").includes(`importKey=${order.importKey}`)) {
      counters.participantsExisting += 1
      return existing.id
    }
    await sb
      .from("vendor_hub_participant_status")
      .update({
        lifecycle_status: "paid",
        application_id: applicationId,
        notes: `${existing.notes || ""}\n${notes}`.trim(),
      })
      .eq("id", existing.id)
    counters.participantsUpdated += 1
    return existing.id
  }

  const { data: created, error } = await sb
    .from("vendor_hub_participant_status")
    .insert({
      organization_id: orgId,
      vendor_hub_event_id: eventId,
      contact_id: contactId,
      application_id: applicationId,
      lifecycle_status: "paid",
      notes,
    })
    .select("id")
    .single()
  if (error) throw new Error(`Create participant: ${error.message}`)
  counters.participantsCreated += 1
  return created.id
}

async function ensureAssignment(sb, eventId, boothId, contactId, order, counters) {
  const { data: existing } = await sb
    .from("vendor_hub_booth_assignments")
    .select("id")
    .eq("event_id", eventId)
    .eq("booth_id", boothId)
    .maybeSingle()

  if (existing?.id) {
    await sb
      .from("vendor_hub_booth_assignments")
      .update({
        contact_id: contactId,
        fee_amount: order.feeAmount,
        status: "confirmed",
      })
      .eq("id", existing.id)
    counters.assignmentsExisting += 1
    return existing.id
  }

  const { data: created, error } = await sb
    .from("vendor_hub_booth_assignments")
    .insert({
      event_id: eventId,
      booth_id: boothId,
      contact_id: contactId,
      fee_amount: order.feeAmount,
      status: "confirmed",
    })
    .select("id")
    .single()
  if (error || !created?.id) {
    throw new Error(error?.message || "Failed to assign booth")
  }
  counters.assignmentsCreated += 1
  return created.id
}

async function ensurePayment(sb, eventId, assignmentId, contactId, order, counters, importedKeys) {
  if (!(order.feeAmount > 0)) {
    counters.paymentsSkippedZero += 1
    return
  }
  if (importedKeys.has(order.importKey)) {
    counters.paymentsExisting += 1
    return
  }

  const { error } = await sb.from("vendor_hub_payments").insert({
    event_id: eventId,
    booth_assignment_id: assignmentId,
    contact_id: contactId,
    amount: order.feeAmount,
    payment_method: order.paymentMethod,
    payment_date: order.paymentDate,
    payment_type: "payment",
    processor: order.paymentMethod?.toLowerCase() || null,
    payer_email: order.email,
    notes: `${IMPORT_TAG}:importKey=${order.importKey}\ncategory=${order.boothCategory}\nmethod=${order.paymentMethod}\nbooth=${order.boothNumber}`,
  })
  if (error) throw new Error(`Create payment: ${error.message}`)
  importedKeys.add(order.importKey)
  counters.paymentsCreated += 1
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  if (!existsSync(args.csv)) {
    console.error(`CSV not found: ${args.csv}`)
    process.exit(1)
  }

  const planned = loadPlannedRows(args.csv)
  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    csv: args.csv,
    event: {
      name: EVENT_NAME,
      date: EVENT_DATE,
      start: START_TIME,
      end: END_TIME,
      location: LOCATION,
    },
    summary: {
      csv_rows: planned.csvRows,
      skipped: planned.skipped.length,
      unique_contacts: planned.contacts.length,
      orders: planned.orders.length,
      booth_types: planned.boothTypes.length,
      total_revenue: planned.totalRevenue,
    },
    booth_types: planned.boothTypes.map((t) => ({
      name: t.name,
      price: t.price,
      count: t.count,
      location: t.location,
    })),
    sample_orders: planned.orders.slice(0, 8).map((o) => ({
      name: o.contactName,
      email: o.email,
      booth: o.boothNumber,
      category: o.boothCategory,
      fee: o.feeAmount,
      method: o.paymentMethod,
    })),
    skipped: planned.skipped,
    counters: {
      contactsMatched: 0,
      contactsCreated: 0,
      applicationsCreated: 0,
      applicationsApproved: 0,
      applicationsExisting: 0,
      affiliationsSynced: 0,
      internalEventsCreated: 0,
      internalEventsExisting: 0,
      eventsCreated: 0,
      eventsExisting: 0,
      boothTypesCreated: 0,
      boothTypesExisting: 0,
      boothsCreated: 0,
      boothsExisting: 0,
      participantsCreated: 0,
      participantsUpdated: 0,
      participantsExisting: 0,
      assignmentsCreated: 0,
      assignmentsExisting: 0,
      paymentsCreated: 0,
      paymentsExisting: 0,
      paymentsSkippedZero: 0,
    },
    ids: {},
    errors: [],
  }

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const reportPath = resolve(
    outDir,
    args.execute ? "fall-bazaar-101026-execute.json" : "fall-bazaar-101026-dry-run.json"
  )

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

  const contactIdByEmail = new Map()
  const applicationIdByEmail = new Map()
  const importedPaymentKeys = new Set()

  const { data: existingPayments } = await sb
    .from("vendor_hub_payments")
    .select("id, notes")
    .ilike("notes", `%${IMPORT_TAG}%`)
  for (const payment of existingPayments || []) {
    const match = String(payment.notes || "").match(/importKey=([a-f0-9]{24})/i)
    if (match) importedPaymentKeys.add(match[1])
  }

  const eventIds = await ensureInternalEvent(sb, args.orgId, report.counters)
  const bazaarId = await ensureBazaarEvent(
    sb,
    args.orgId,
    eventIds.internalEventId,
    eventIds.bazaarId,
    planned.orders.length,
    report.counters
  )
  report.ids = {
    vendor_hub_event_id: bazaarId,
    internal_event_id: eventIds.internalEventId,
  }

  const boothTypeIdByName = await ensureBoothTypes(
    sb,
    args.orgId,
    bazaarId,
    planned.boothTypes,
    report.counters
  )

  for (const contact of planned.contacts) {
    try {
      const contactId = await findOrCreateContact(sb, args.orgId, contact, report.counters)
      contactIdByEmail.set(contact.email, contactId)
      const applicationId = await ensureVendorApplication(
        sb,
        args.orgId,
        contactId,
        contact,
        report.counters
      )
      applicationIdByEmail.set(contact.email, applicationId)
      await ensureVendorRole(sb, args.orgId, contactId)
      const { error: syncError } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: args.orgId,
        p_contact_id: contactId,
      })
      if (syncError) {
        report.errors.push({
          email: contact.email,
          error: `sync_contact_affiliations: ${syncError.message}`,
        })
      } else {
        report.counters.affiliationsSynced += 1
      }
    } catch (error) {
      report.errors.push({
        email: contact.email,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const order of planned.orders) {
    try {
      const contactId = contactIdByEmail.get(order.email)
      const applicationId = applicationIdByEmail.get(order.email)
      const typeId = boothTypeIdByName.get(order.boothCategory)
      if (!contactId || !typeId) {
        report.errors.push({
          email: order.email,
          booth: order.boothNumber,
          error: "Missing contact or booth type after setup",
        })
        continue
      }
      const boothId = await ensureBooth(sb, bazaarId, typeId, order, report.counters)
      await ensureParticipant(
        sb,
        args.orgId,
        bazaarId,
        contactId,
        applicationId || null,
        order,
        report.counters
      )
      const assignmentId = await ensureAssignment(
        sb,
        bazaarId,
        boothId,
        contactId,
        order,
        report.counters
      )
      await ensurePayment(
        sb,
        bazaarId,
        assignmentId,
        contactId,
        order,
        report.counters,
        importedPaymentKeys
      )
    } catch (error) {
      report.errors.push({
        email: order.email,
        booth: order.boothNumber,
        importKey: order.importKey,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nWrote ${reportPath}`)
  if (report.errors.length) {
    console.error(`Completed with ${report.errors.length} errors.`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
