/**
 * Upsert Vendor Network contacts from vendorUpdate.csv (contact-centric).
 *
 * For each row (matched by email):
 * - find or create CRM contact (full_name, phone)
 * - ensure one approved org vendor application (vendor role via affiliation sync)
 * - update application form_data: business_name, social, products/selling
 *
 * Does NOT create events, payments, or booth assignments.
 *
 * Usage (dry-run by default):
 *   node scripts/import-vendor-update-csv.mjs
 *   node scripts/import-vendor-update-csv.mjs --csv "C:/Users/danan/Downloads/vendorUpdate.csv"
 *   node scripts/import-vendor-update-csv.mjs --limit 20
 *   node scripts/import-vendor-update-csv.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "VENDOR_UPDATE_CSV_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "C:/Users/danan/Downloads/vendorUpdate.csv"

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
    } else if (c === "\n") {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ""
    } else if (c === "\r") {
      // skip
    } else {
      cur += c
    }
  }
  if (cur.length || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
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

function loadPlannedRows(csvPath, limit) {
  const raw = readFileSync(csvPath, "utf8")
  const table = parseCSV(raw.replace(/^\uFEFF/, ""))
  const header = table[0].map((h) => normalizeText(h))
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))

  const get = (row, name) => normalizeText(row[idx[name]])

  /** @type {Map<string, object>} */
  const byEmail = new Map()
  let skippedNoEmail = 0
  let duplicateEmailRows = 0

  for (const row of table.slice(1)) {
    if (!row.some((c) => normalizeText(c))) continue

    const email = normalizeEmail(get(row, "Email Address"))
    if (!email || !email.includes("@")) {
      skippedNoEmail += 1
      continue
    }

    const fullName = get(row, "Full Name")
    const names = splitName(fullName)
    const phone = get(row, "Phone Number")
    const businessName = get(row, "Business Name")
    const social = get(row, "Business Instagram and/or Facebook profile")
    const products = get(
      row,
      "What type of products or services does your business provide?"
    )

    const existing = byEmail.get(email)
    if (existing) duplicateEmailRows += 1

    byEmail.set(email, {
      email,
      full_name: fullName || existing?.full_name || email,
      first_name: names.first_name || existing?.first_name || null,
      last_name: names.last_name || existing?.last_name || null,
      phone: phone || existing?.phone || null,
      business_name: businessName || existing?.business_name || null,
      social: social || existing?.social || null,
      selling: products || existing?.selling || null,
    })
  }

  let contacts = [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email))
  if (limit && Number.isFinite(limit)) {
    contacts = contacts.slice(0, limit)
  }

  return {
    header,
    csvRows: table.length - 1,
    skippedNoEmail,
    duplicateEmailRows,
    contacts,
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
  let created = false

  if (rpcError || !contactId) {
    const { data: existing } = await sb
      .from("contacts")
      .select("id, full_name, phone, email")
      .eq("organization_id", orgId)
      .ilike("email", contact.email)
      .eq("contact_type", "individual")
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      contactId = existing.id
      counters.contactsMatched += 1
    } else {
      const { data: inserted, error: insertError } = await sb
        .from("contacts")
        .insert({
          organization_id: orgId,
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
          contact_type: "individual",
          status: "active",
        })
        .select("id")
        .single()
      if (insertError) {
        throw new Error(`Create contact ${contact.email}: ${insertError.message}`)
      }
      contactId = inserted.id
      counters.contactsCreated += 1
      created = true
    }
  } else {
    counters.contactsMatched += 1
  }

  const patch = {
    full_name: contact.full_name,
    phone: contact.phone,
    status: "active",
  }
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v != null && String(v).trim() !== "")
  )
  if (Object.keys(cleanPatch).length > 0) {
    const { error: updateError } = await sb
      .from("contacts")
      .update(cleanPatch)
      .eq("id", contactId)
      .eq("organization_id", orgId)
    if (updateError) {
      throw new Error(`Update contact ${contact.email}: ${updateError.message}`)
    }
    if (!created) counters.contactsUpdated += 1
  }

  return contactId
}

function mergeFormData(existingFormData, contact) {
  const base =
    existingFormData && typeof existingFormData === "object" ? { ...existingFormData } : {}
  const next = {
    ...base,
    business_name: contact.business_name || base.business_name || null,
    social: contact.social || base.social || null,
    selling: contact.selling || base.selling || null,
    products_services: contact.selling || base.products_services || null,
  }
  delete next.import_tag
  return next
}

async function ensureVendorApplication(sb, orgId, contactId, contact, counters) {
  const { data: existing } = await sb
    .from("applications")
    .select("id, status, notes, form_data, applicant_name, applicant_phone, submitted_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("application_type", "vendor")
    .eq("module_owner", "vendor_hub")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: contactRow } = await sb
    .from("contacts")
    .select("last_activity_at, created_at")
    .eq("id", contactId)
    .maybeSingle()

  const [{ data: payments }, { data: participants }] = await Promise.all([
    sb
      .from("vendor_hub_payments")
      .select("payment_date, created_at")
      .eq("contact_id", contactId),
    sb
      .from("vendor_hub_participant_status")
      .select("vendor_hub_event_id")
      .eq("contact_id", contactId),
  ])

  const eventIds = [
    ...new Set(
      (participants || []).map((row) => row.vendor_hub_event_id).filter(Boolean)
    ),
  ]
  let earliestEvent = null
  if (eventIds.length > 0) {
    const { data: events } = await sb
      .from("vendor_hub_events")
      .select("event_date")
      .in("id", eventIds)
    for (const event of events || []) {
      const date = event.event_date
      if (!date) continue
      if (!earliestEvent || date < earliestEvent) earliestEvent = date
    }
  }

  let earliestPayment = null
  for (const payment of payments || []) {
    const date = (payment.payment_date || payment.created_at || "").slice(0, 10)
    if (!date) continue
    if (!earliestPayment || date < earliestPayment) earliestPayment = date
  }

  const earliestParticipation =
    [earliestPayment, earliestEvent].filter(Boolean).sort()[0] || null

  const activityAt = earliestParticipation
    ? `${earliestParticipation}T12:00:00.000Z`
    : contactRow?.created_at || new Date().toISOString()

  const formData = mergeFormData(existing?.form_data, contact)

  if (existing?.id) {
    const patch = {
      form_data: formData,
      applicant_name: contact.full_name || existing.applicant_name,
      applicant_email: contact.email,
      applicant_phone: contact.phone || existing.applicant_phone,
      status: "approved",
      submitted_at: existing.submitted_at || activityAt,
    }

    const { error } = await sb.from("applications").update(patch).eq("id", existing.id)
    if (error) throw new Error(`Update application ${contact.email}: ${error.message}`)

    if (existing.status !== "approved") {
      counters.applicationsApproved += 1
    } else {
      counters.applicationsUpdated += 1
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
      submitted_at: activityAt,
      form_data: formData,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Create application ${contact.email}: ${error.message}`)
  counters.applicationsCreated += 1
  return created.id
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const csvPath = resolve(args.csv)

  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }

  const planned = loadPlannedRows(csvPath, args.limit)
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })

  const summary = {
    mode: args.execute ? "execute" : "dry-run",
    importTag: IMPORT_TAG,
    orgId: args.orgId,
    csvPath,
    csvRows: planned.csvRows,
    skippedNoEmail: planned.skippedNoEmail,
    duplicateEmailRows: planned.duplicateEmailRows,
    uniqueContacts: planned.contacts.length,
    sample: planned.contacts.slice(0, 8).map((c) => ({
      email: c.email,
      full_name: c.full_name,
      business_name: c.business_name,
      phone: c.phone,
      selling: c.selling,
      social: c.social,
    })),
  }

  if (!args.execute) {
    const out = resolve(reportDir, "vendor-update-import-dry-run.json")
    writeFileSync(out, JSON.stringify(summary, null, 2))
    console.log(JSON.stringify(summary, null, 2))
    console.log(`\nDry-run report: ${out}`)
    console.log("Re-run with --execute to write contacts + vendor applications.")
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

  const counters = {
    contactsMatched: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    applicationsCreated: 0,
    applicationsUpdated: 0,
    applicationsApproved: 0,
    errors: [],
  }

  for (const contact of planned.contacts) {
    try {
      const contactId = await findOrCreateContact(sb, args.orgId, contact, counters)
      await ensureVendorApplication(sb, args.orgId, contactId, contact, counters)
    } catch (error) {
      counters.errors.push({
        email: contact.email,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const result = {
    ...summary,
    counters,
  }
  const out = resolve(reportDir, "vendor-update-import-execute.json")
  writeFileSync(out, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  console.log(`\nExecute report: ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
