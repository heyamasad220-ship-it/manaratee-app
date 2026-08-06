/**
 * Import historical BazaarVendors.csv → Vendor Hub (contact-centric).
 *
 * Creates/updates:
 * - contacts (upsert by email via find_or_create_contact_for_org)
 * - one approved org-level vendor application per contact (vendor affiliation)
 * - vendor_hub_events (upsert by name + event_date)
 * - vendor_hub_participant_status (per event + contact)
 * - vendor_hub_payments when fee > 0 (no booth assignment — CSV has no booth numbers)
 *
 * Does NOT write to legacy `vendors` / `vendor_hub_vendors`.
 *
 * Usage (dry-run by default):
 *   node scripts/import-bazaar-vendors-csv.mjs
 *   node scripts/import-bazaar-vendors-csv.mjs --csv "C:/Users/danan/Downloads/BazaarVendors.csv"
 *   node scripts/import-bazaar-vendors-csv.mjs --limit 20
 *   node scripts/import-bazaar-vendors-csv.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "BAZAAR_VENDORS_CSV_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "C:/Users/danan/Downloads/BazaarVendors.csv"
const DEFAULT_VENUE_NAME = "MAS Dallas Islamic Center"

const BIZ_COLS = [
  "What is the name of your business?",
  "What is your business name?",
  "what is your business name?",
]
const SELLING_COLS = [
  "What Are you selling?",
  "What are you selling?",
  "What products are you selling?(details please)",
]
const SOCIAL_COLS = [
  "Do you have a website or/and social media for your business? please listed below?",
  "Do you have a website or social media for your business?",
  "Please share your social media addresses, e.g. Facebook, Instagram, etc.",
  "What is the link to your business if applicable?",
  "Do you have a website or social media account?",
]

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

function firstNonEmpty(row, idx, names) {
  for (const name of names) {
    const v = normalizeText(row[idx[name]])
    if (v) return v
  }
  return ""
}

function parseEventStart(label) {
  const d = new Date(label)
  if (Number.isNaN(d.getTime())) return { date: null, time: null }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}:00` }
}

function parsePaymentDate(orderDate) {
  const raw = normalizeText(orderDate)
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function eventStatusForDate(eventDate) {
  if (!eventDate) return "draft"
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, "0")
  const dd = String(today.getDate()).padStart(2, "0")
  const todayKey = `${yyyy}-${mm}-${dd}`
  return eventDate < todayKey ? "completed" : "draft"
}

function splitName(fullName, firstName, lastName) {
  const first = normalizeText(firstName)
  const last = normalizeText(lastName)
  if (first || last) return { first_name: first || null, last_name: last || null }
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0], last_name: null }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

function buildParticipationNotes(row) {
  const bits = [
    IMPORT_TAG,
    `importKey=${row.importKey}`,
    row.boothCategory ? `category=${row.boothCategory}` : null,
    row.selling ? `selling=${row.selling}` : null,
    row.social ? `social=${row.social}` : null,
  ].filter(Boolean)
  return bits.join("\n")
}

function loadPlannedRows(csvPath, limit) {
  const raw = readFileSync(csvPath, "utf8")
  const table = parseCSV(raw.replace(/^\uFEFF/, ""))
  const header = table[0]
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  const data = table.slice(1).filter((r) => r.some((c) => String(c).trim()))

  /** @type {Map<string, object>} */
  const eventsByKey = new Map()
  /** @type {Map<string, object>} */
  const contactsByEmail = new Map()
  const participations = []
  let skippedNoEmail = 0

  for (const row of data) {
    const get = (name) => normalizeText(row[idx[name]])
    const email = normalizeEmail(get("Email"))
    if (!email) {
      skippedNoEmail += 1
      continue
    }

    const eventName = get("Event name") || "Untitled bazaar"
    const eventStartLabel = get("Event start")
    const eventEndLabel = get("Event end")
    const start = parseEventStart(eventStartLabel)
    const end = parseEventStart(eventEndLabel)
    const eventKey = `${eventName}::${start.date || eventStartLabel}`

    if (!eventsByKey.has(eventKey)) {
      eventsByKey.set(eventKey, {
        eventKey,
        name: eventName,
        event_date: start.date,
        start_time: start.time,
        end_time: end.time,
        source_start_label: eventStartLabel,
        source_end_label: eventEndLabel,
        vendor_row_count: 0,
        status: eventStatusForDate(start.date),
      })
    }
    eventsByKey.get(eventKey).vendor_row_count += 1

    const businessName = firstNonEmpty(row, idx, BIZ_COLS)
    const selling = firstNonEmpty(row, idx, SELLING_COLS)
    const social = firstNonEmpty(row, idx, SOCIAL_COLS)
    const boothCategory = get("Description")
    const amount = Number(get("Value") || 0)
    const paymentMethod = get("Payment method")
    const orderDate = get("Order date")
    const fullName = get("Name")
    const names = splitName(fullName, get("First Name"), get("Last Name"))

    const paymentDate = parsePaymentDate(orderDate)
    const activityDate = paymentDate || start.date || null

    const existingContact = contactsByEmail.get(email)
    const priorActivity = existingContact?.latest_activity_date || null
    const latestActivity =
      activityDate && (!priorActivity || activityDate > priorActivity)
        ? activityDate
        : priorActivity

    contactsByEmail.set(email, {
      email,
      first_name: names.first_name || existingContact?.first_name || null,
      last_name: names.last_name || existingContact?.last_name || null,
      full_name:
        fullName ||
        [names.first_name, names.last_name].filter(Boolean).join(" ") ||
        existingContact?.full_name ||
        email,
      phone: get("Mobile number") || existingContact?.phone || null,
      company_name: businessName || existingContact?.company_name || null,
      address_line1: get("Address 1") || existingContact?.address_line1 || null,
      city: get("Address 2") || existingContact?.city || null,
      state: get("Address 3") || existingContact?.state || null,
      postal_code: get("Postcode / Zip") || existingContact?.postal_code || null,
      event_count: (existingContact?.event_count || 0) + 1,
      selling: selling || existingContact?.selling || null,
      social: social || existingContact?.social || null,
      latest_activity_date: latestActivity,
    })

    const participationImportKey = importKey([
      IMPORT_TAG,
      email,
      eventKey,
      String(Number.isFinite(amount) ? amount : 0),
      orderDate,
      paymentMethod,
      boothCategory,
    ])

    participations.push({
      importKey: participationImportKey,
      eventKey,
      eventName,
      eventDate: start.date,
      startTime: start.time,
      endTime: end.time,
      email,
      contactName: fullName || null,
      companyName: businessName || null,
      boothCategory: boothCategory || null,
      selling: selling || null,
      social: social || null,
      feeAmount: Number.isFinite(amount) ? amount : 0,
      paymentMethod: paymentMethod || null,
      paidAt: orderDate || null,
      paymentDate: parsePaymentDate(orderDate),
      lifecycle: amount > 0 ? "paid" : "assigned",
    })
  }

  let planned = participations
  if (limit && Number.isFinite(limit)) {
    planned = planned.slice(0, limit)
  }

  const plannedEventKeys = new Set(planned.map((p) => p.eventKey))
  const plannedEmails = new Set(planned.map((p) => p.email))

  return {
    csvRows: data.length,
    skippedNoEmail,
    events: [...eventsByKey.values()]
      .filter((e) => plannedEventKeys.has(e.eventKey))
      .sort((a, b) => String(b.event_date || "").localeCompare(String(a.event_date || ""))),
    contacts: [...contactsByEmail.values()]
      .filter((c) => plannedEmails.has(c.email))
      .sort((a, b) => a.email.localeCompare(b.email)),
    participations: planned,
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

  const patch = {
    first_name: contact.first_name,
    last_name: contact.last_name,
    company_name: contact.company_name,
    phone: contact.phone,
    address_line1: contact.address_line1,
    city: contact.city,
    state: contact.state,
    postal_code: contact.postal_code,
    ...(contact.latest_activity_date
      ? { last_activity_at: `${contact.latest_activity_date}T12:00:00.000Z` }
      : {}),
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
    .select("id, status, notes")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("application_type", "vendor")
    .eq("module_owner", "vendor_hub")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    if (existing.status !== "approved") {
      const { error } = await sb
        .from("applications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          notes: `${existing.notes || ""}\n${IMPORT_TAG}:approved`.trim(),
        })
        .eq("id", existing.id)
      if (error) throw new Error(`Approve application: ${error.message}`)
      counters.applicationsApproved += 1
    } else {
      counters.applicationsExisting += 1
    }
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
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      form_data: {
        import_tag: IMPORT_TAG,
        business_name: contact.company_name,
        selling: contact.selling,
        social: contact.social,
      },
      notes: `${IMPORT_TAG}:org_vendor_application`,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Create application ${contact.email}: ${error.message}`)
  counters.applicationsCreated += 1
  return created.id
}

async function ensureEvent(sb, orgId, event, counters, eventIdByKey) {
  if (eventIdByKey.has(event.eventKey)) {
    return eventIdByKey.get(event.eventKey)
  }

  let query = sb
    .from("vendor_hub_events")
    .select("id, name, event_date, status")
    .eq("organization_id", orgId)
    .eq("name", event.name)

  if (event.event_date) {
    query = query.eq("event_date", event.event_date)
  } else {
    query = query.is("event_date", null)
  }

  const { data: existing, error: lookupError } = await query.limit(1).maybeSingle()
  if (lookupError) throw new Error(`Event lookup ${event.name}: ${lookupError.message}`)

  if (existing?.id) {
    eventIdByKey.set(event.eventKey, existing.id)
    counters.eventsExisting += 1
    return existing.id
  }

  const { data: created, error } = await sb
    .from("vendor_hub_events")
    .insert({
      organization_id: orgId,
      name: event.name,
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      location: DEFAULT_VENUE_NAME,
      status: event.status,
      calendar_status: "not_published",
      description: `Imported from BazaarVendors.csv (${IMPORT_TAG})`,
      expected_attendees: 0,
      total_booths: event.vendor_row_count || 0,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Create event ${event.name}: ${error.message}`)
  eventIdByKey.set(event.eventKey, created.id)
  counters.eventsCreated += 1
  return created.id
}

async function ensureParticipant(sb, orgId, eventId, contactId, applicationId, row, counters) {
  const { data: existing } = await sb
    .from("vendor_hub_participant_status")
    .select("id, notes, lifecycle_status")
    .eq("organization_id", orgId)
    .eq("vendor_hub_event_id", eventId)
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle()

  const notes = buildParticipationNotes(row)

  if (existing?.id) {
    if (String(existing.notes || "").includes(`importKey=${row.importKey}`)) {
      counters.participantsExisting += 1
      return existing.id
    }
    const { error } = await sb
      .from("vendor_hub_participant_status")
      .update({
        lifecycle_status: row.lifecycle,
        application_id: applicationId,
        notes: `${existing.notes || ""}\n${notes}`.trim(),
      })
      .eq("id", existing.id)
    if (error) throw new Error(`Update participant: ${error.message}`)
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
      lifecycle_status: row.lifecycle,
      notes,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Create participant: ${error.message}`)
  counters.participantsCreated += 1
  return created.id
}

async function ensurePayment(sb, orgId, eventId, contactId, row, counters, importedPaymentKeys) {
  if (!(row.feeAmount > 0)) {
    counters.paymentsSkippedZero += 1
    return null
  }

  if (importedPaymentKeys.has(row.importKey)) {
    counters.paymentsExisting += 1
    return null
  }

  const notes = `${IMPORT_TAG}:importKey=${row.importKey}\ncategory=${row.boothCategory || ""}\nmethod=${row.paymentMethod || ""}`

  const { error } = await sb.from("vendor_hub_payments").insert({
    event_id: eventId,
    booth_assignment_id: null,
    contact_id: contactId,
    amount: row.feeAmount,
    payment_method: row.paymentMethod || "imported",
    payment_date: row.paymentDate || row.eventDate || new Date().toISOString().slice(0, 10),
    payment_type: "payment",
    notes,
  })

  if (error) throw new Error(`Create payment: ${error.message}`)
  importedPaymentKeys.add(row.importKey)
  counters.paymentsCreated += 1
  return true
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  if (!existsSync(args.csv)) {
    console.error(`CSV not found: ${args.csv}`)
    process.exit(1)
  }

  const planned = loadPlannedRows(args.csv, args.limit)

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    csv: args.csv,
    summary: {
      csv_rows: planned.csvRows,
      skipped_no_email: planned.skippedNoEmail,
      unique_events: planned.events.length,
      unique_contacts: planned.contacts.length,
      participation_rows: planned.participations.length,
      payments_with_amount: planned.participations.filter((p) => p.feeAmount > 0).length,
    },
    counters: {
      contactsMatched: 0,
      contactsCreated: 0,
      applicationsCreated: 0,
      applicationsApproved: 0,
      applicationsExisting: 0,
      eventsCreated: 0,
      eventsExisting: 0,
      participantsCreated: 0,
      participantsUpdated: 0,
      participantsExisting: 0,
      paymentsCreated: 0,
      paymentsExisting: 0,
      paymentsSkippedZero: 0,
      affiliationsSynced: 0,
    },
    sample_events: planned.events.slice(0, 8).map((e) => ({
      name: e.name,
      date: e.event_date,
      vendors: e.vendor_row_count,
      status: e.status,
    })),
    sample_participations: planned.participations.slice(0, 12).map((p) => ({
      event: p.eventName,
      date: p.eventDate,
      email: p.email,
      business: p.companyName,
      fee: p.feeAmount,
      lifecycle: p.lifecycle,
      importKey: p.importKey,
    })),
    errors: [],
  }

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const reportPath = resolve(
    outDir,
    args.execute ? "bazaar-vendors-import-execute.json" : "bazaar-vendors-import-dry-run.json"
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

  const eventIdByKey = new Map()
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

  for (const event of planned.events) {
    try {
      await ensureEvent(sb, args.orgId, event, report.counters, eventIdByKey)
    } catch (error) {
      report.errors.push({
        event: event.name,
        date: event.event_date,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const row of planned.participations) {
    try {
      const contactId = contactIdByEmail.get(row.email)
      const applicationId = applicationIdByEmail.get(row.email)
      const eventId = eventIdByKey.get(row.eventKey)
      if (!contactId || !eventId) {
        report.errors.push({
          email: row.email,
          event: row.eventName,
          error: "Missing contact or event id after setup",
        })
        continue
      }
      await ensureParticipant(
        sb,
        args.orgId,
        eventId,
        contactId,
        applicationId || null,
        row,
        report.counters
      )
      await ensurePayment(
        sb,
        args.orgId,
        eventId,
        contactId,
        row,
        report.counters,
        importedPaymentKeys
      )
    } catch (error) {
      report.errors.push({
        email: row.email,
        event: row.eventName,
        importKey: row.importKey,
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
