/**
 * Import donor contact info from CSV: match existing contacts, fill missing
 * email/phone, create unmatched rows, and ensure donors extension rows.
 *
 * Usage:
 *   node scripts/enrich-donor-contacts-from-csv.mjs --file "C:/path/MadinaDonors.csv" --execute
 *   node scripts/enrich-donor-contacts-from-csv.mjs --file "..." --org <uuid> --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const STAMP = new Date().toISOString().slice(0, 10)

function loadEnv() {
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
    file: null,
    orgId: DEFAULT_ORG_ID,
    execute: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--execute") args.execute = true
    else if (arg === "--file") args.file = argv[++index]
    else if (arg === "--org") args.orgId = argv[++index]
  }

  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeNameForMatch(value) {
  const withoutParens = normalizeText(value).replace(/\([^)]*\)/g, " ")
  return normalizeName(withoutParens).replace(/^(dr|mr|mrs|ms|sheikh)\s+/, "")
}

function normalizeEmail(value) {
  const text = normalizeText(value).toLowerCase()
  return text.includes("@") ? text : ""
}

function normalizePhone(value) {
  const digits = normalizeText(value).replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits
}

function formatPhoneForStorage(value) {
  const digits = normalizePhone(value)
  return digits.length >= 7 ? digits : normalizeText(value) || null
}

function scoreNameMatch(a, b) {
  const left = normalizeNameForMatch(a)
  const right = normalizeNameForMatch(b)
  if (!left || !right) return 0
  if (left === right) return 100

  const leftParts = left.split(" ").filter(Boolean)
  const rightParts = right.split(" ").filter(Boolean)
  const shared = leftParts.filter((part) => rightParts.includes(part))
  if (shared.length === 0) return 0

  if (shared.length >= 2) {
    if (shared.length === leftParts.length || shared.length === rightParts.length) return 85
    return 72
  }

  return 0
}

function sanitizeCsvRow(row) {
  let fullName = normalizeText(row.full_name)
  let email = normalizeEmail(row.email)
  let phone = formatPhoneForStorage(row.phone)

  if (!email && fullName.includes("@")) {
    email = normalizeEmail(fullName)
    const local = email.split("@")[0] || ""
    fullName = local.replace(/[._-]+/g, " ").trim() || fullName
  }

  return {
    full_name: fullName,
    email: email || null,
    phone,
    status: normalizeText(row.status) || "active",
    contact_type: normalizeText(row.contact_type) || "individual",
    organization_id: normalizeText(row.organization_id) || DEFAULT_ORG_ID,
  }
}

function buildContactIndexes(contacts) {
  const byEmail = new Map()
  const byPhone = new Map()
  const byName = new Map()

  for (const contact of contacts) {
    rememberContactInIndexes(contact, { byEmail, byPhone, byName })
  }

  return { byEmail, byPhone, byName }
}

function rememberContactInIndexes(contact, indexes) {
  const email = normalizeEmail(contact.email)
  const phone = normalizePhone(contact.phone)
  const nameKey = normalizeNameForMatch(contact.full_name)

  if (email && !indexes.byEmail.has(email)) indexes.byEmail.set(email, contact)
  if (phone && phone.length >= 7 && !indexes.byPhone.has(phone)) {
    indexes.byPhone.set(phone, contact)
  }
  if (nameKey) {
    const list = indexes.byName.get(nameKey) || []
    if (!list.some((item) => item.id === contact.id)) {
      list.push(contact)
      indexes.byName.set(nameKey, list)
    }
  }
}

function findContactMatch(row, indexes) {
  const email = normalizeEmail(row.email)
  const phone = normalizePhone(row.phone)
  const nameKey = normalizeNameForMatch(row.full_name)

  if (email && indexes.byEmail.has(email)) {
    return { contact: indexes.byEmail.get(email), reason: "email" }
  }

  if (phone.length >= 7 && indexes.byPhone.has(phone)) {
    return { contact: indexes.byPhone.get(phone), reason: "phone" }
  }

  const exactNameMatches = indexes.byName.get(nameKey) || []
  if (exactNameMatches.length === 1) {
    return { contact: exactNameMatches[0], reason: "exact_name" }
  }

  if (phone.length >= 7 && exactNameMatches.length > 1) {
    const phoneMatch = exactNameMatches.find(
      (contact) => normalizePhone(contact.phone) === phone
    )
    if (phoneMatch) return { contact: phoneMatch, reason: "name+phone" }
  }

  let best = null
  let bestScore = 0
  for (const candidates of indexes.byName.values()) {
    for (const contact of candidates) {
      const score = scoreNameMatch(row.full_name, contact.full_name)
      if (score > bestScore) {
        bestScore = score
        best = contact
      }
    }
  }

  if (best && bestScore >= 85) {
    return { contact: best, reason: `fuzzy_name:${bestScore}` }
  }

  return null
}

function buildEnrichmentPatch(existing, row) {
  const patch = {}
  const conflicts = []

  const csvEmail = normalizeEmail(row.email)
  const csvPhone = normalizePhone(row.phone)
  const existingEmail = normalizeEmail(existing.email)
  const existingPhone = normalizePhone(existing.phone)

  if (csvEmail) {
    if (!existingEmail) patch.email = csvEmail
    else if (existingEmail !== csvEmail) {
      conflicts.push(`email (${existingEmail} vs ${csvEmail})`)
    }
  }

  if (csvPhone.length >= 7) {
    if (!existingPhone) patch.phone = row.phone
    else if (existingPhone !== csvPhone) {
      conflicts.push(`phone (${existingPhone} vs ${csvPhone})`)
    }
  }

  return { patch, conflicts }
}

loadEnv()

const args = parseArgs(process.argv.slice(2))

if (!args.file) {
  console.error(
    'Usage: node scripts/enrich-donor-contacts-from-csv.mjs --file "<path>" [--org <uuid>] --execute'
  )
  process.exit(1)
}

if (!existsSync(args.file)) {
  console.error(`File not found: ${args.file}`)
  process.exit(1)
}

if (!args.execute) {
  console.error("Pass --execute to apply changes.")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, filters = []) {
  const rows = []
  let from = 0

  while (true) {
    let query = sb.from(table).select("*").range(from, from + 999)
    for (const filter of filters) {
      if (filter.op === "eq") query = query.eq(filter.col, filter.val)
    }

    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break

    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }

  return rows
}

async function createContact(orgId, row) {
  const { data: contactId, error } = await sb.rpc("find_or_create_contact_for_org", {
    p_organization_id: orgId,
    p_full_name: row.full_name,
    p_email: row.email,
    p_phone: row.phone,
    p_contact_type: row.contact_type,
  })

  if (error || !contactId) {
    throw new Error(error?.message || `Could not create contact for ${row.full_name}`)
  }

  const { data, error: fetchError } = await sb
    .from("contacts")
    .select("id, full_name, email, phone, contact_type, status")
    .eq("id", contactId)
    .single()

  if (fetchError || !data) {
    throw new Error(fetchError?.message || `Could not load created contact ${contactId}`)
  }

  const { patch } = buildEnrichmentPatch(data, row)
  if (Object.keys(patch).length === 0) {
    return { contact: data, created: true }
  }

  const { data: updated, error: updateError } = await sb
    .from("contacts")
    .update(patch)
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .select("id, full_name, email, phone, contact_type, status")
    .single()

  if (updateError) {
    throw new Error(updateError.message || `Could not enrich new contact ${contactId}`)
  }

  return { contact: updated, created: true }
}

async function enrichContact(orgId, contact, row) {
  const { patch, conflicts } = buildEnrichmentPatch(contact, row)
  if (Object.keys(patch).length === 0) {
    return { contact, enriched: false, conflicts }
  }

  const { data, error } = await sb
    .from("contacts")
    .update(patch)
    .eq("id", contact.id)
    .eq("organization_id", orgId)
    .select("id, full_name, email, phone, contact_type, status")
    .single()

  if (error) {
    throw new Error(error.message || `Could not update contact ${contact.id}`)
  }

  return { contact: data, enriched: true, conflicts }
}

async function ensureDonorExtension(orgId, contact, donorByContactId) {
  const existingId = donorByContactId.get(contact.id)
  if (existingId) {
    const { data: existing, error: fetchError } = await sb
      .from("donors")
      .select("id, email, phone")
      .eq("id", existingId)
      .single()

    if (fetchError) throw new Error(fetchError.message)

    const donorPatch = {}
    if (contact.email && !normalizeEmail(existing.email)) donorPatch.email = contact.email
    if (contact.phone && !normalizePhone(existing.phone)) donorPatch.phone = contact.phone

    if (Object.keys(donorPatch).length > 0) {
      const { error: updateError } = await sb
        .from("donors")
        .update(donorPatch)
        .eq("id", existingId)
        .eq("organization_id", orgId)

      if (updateError) throw new Error(updateError.message)
    }

    return { donorId: existingId, created: false }
  }

  const { data, error } = await sb
    .from("donors")
    .insert({
      organization_id: orgId,
      contact_id: contact.id,
      full_name: contact.full_name || "Unnamed",
      email: contact.email,
      phone: contact.phone,
      donor_type: contact.contact_type === "organization" ? "organization" : "individual",
      status: "active",
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await sb
        .from("donors")
        .select("id")
        .eq("organization_id", orgId)
        .eq("contact_id", contact.id)
        .maybeSingle()
      if (retry?.id) {
        donorByContactId.set(contact.id, retry.id)
        return { donorId: retry.id, created: false }
      }
    }
    throw new Error(error.message || `Could not create donor for contact ${contact.id}`)
  }

  donorByContactId.set(contact.id, data.id)
  return { donorId: data.id, created: true }
}

async function syncAffiliation(orgId, contactId) {
  const { error } = await sb.rpc("sync_contact_affiliations", {
    p_organization_id: orgId,
    p_contact_id: contactId,
  })
  if (error) {
    throw new Error(`sync_contact_affiliations (${contactId}): ${error.message}`)
  }
}

async function main() {
  const csvText = readFileSync(args.file, "utf8")
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    console.error("CSV parse errors:", parsed.errors.slice(0, 5))
    process.exit(1)
  }

  const rows = parsed.data.map(sanitizeCsvRow).filter((row) => row.full_name)
  const orgIds = [...new Set(rows.map((row) => row.organization_id))]
  if (orgIds.length !== 1) {
    console.error("Expected a single organization_id in file:", orgIds)
    process.exit(1)
  }

  const orgId = args.orgId || orgIds[0]
  if (orgId !== orgIds[0]) {
    console.error(`File organization_id ${orgIds[0]} does not match --org ${orgId}`)
    process.exit(1)
  }

  const contacts = await fetchAll("contacts", [{ op: "eq", col: "organization_id", val: orgId }])
  const donors = await fetchAll("donors", [{ op: "eq", col: "organization_id", val: orgId }])

  const contactIndexes = buildContactIndexes(contacts)
  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor.id])
  )

  const report = {
    mode: "execute",
    file: args.file,
    organizationId: orgId,
    rowCount: rows.length,
    matched: 0,
    created: 0,
    enriched: 0,
    unchanged: 0,
    donorsCreated: 0,
    donorsEnriched: 0,
    conflicts: [],
    fuzzyMatches: [],
    errors: [],
    samples: [],
  }

  const affectedContactIds = new Set()

  for (const row of rows) {
    try {
      let contact
      let matchReason = "created"

      const match = findContactMatch(row, contactIndexes)
      if (match) {
        report.matched += 1
        matchReason = match.reason
        if (matchReason.startsWith("fuzzy_name")) {
          report.fuzzyMatches.push({
            csvName: row.full_name,
            matchedName: match.contact.full_name,
            reason: matchReason,
          })
        }

        const result = await enrichContact(orgId, match.contact, row)
        contact = result.contact
        if (result.enriched) report.enriched += 1
        else report.unchanged += 1
        if (result.conflicts.length > 0) {
          report.conflicts.push({
            csvName: row.full_name,
            contactId: contact.id,
            contactName: contact.full_name,
            conflicts: result.conflicts,
          })
        }
      } else {
        const result = await createContact(orgId, row)
        contact = result.contact
        report.created += 1
        contacts.push(contact)
        rememberContactInIndexes(contact, contactIndexes)
      }

      const donorResult = await ensureDonorExtension(orgId, contact, donorByContactId)
      if (donorResult.created) report.donorsCreated += 1
      else if (contact.email || contact.phone) report.donorsEnriched += 1

      affectedContactIds.add(contact.id)

      if (report.samples.length < 12) {
        report.samples.push({
          csvName: row.full_name,
          contactId: contact.id,
          contactName: contact.full_name,
          matchReason,
          email: contact.email,
          phone: contact.phone,
        })
      }
    } catch (error) {
      report.errors.push({
        csvName: row.full_name,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const contactId of affectedContactIds) {
    try {
      await syncAffiliation(orgId, contactId)
    } catch (error) {
      report.errors.push({
        contactId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(reportDir, { recursive: true })
  const reportPath = resolve(reportDir, `enrich-donor-contacts-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log("=== Donor contact enrichment import ===\n")
  console.log(`File: ${args.file}`)
  console.log(`Organization: ${orgId}`)
  console.log(`Rows processed: ${rows.length}`)
  console.log(`Matched existing contacts: ${report.matched}`)
  console.log(`Created new contacts: ${report.created}`)
  console.log(`Enriched contacts (filled missing fields): ${report.enriched}`)
  console.log(`Unchanged matches: ${report.unchanged}`)
  console.log(`Donor extensions created: ${report.donorsCreated}`)
  console.log(`Fuzzy name matches: ${report.fuzzyMatches.length}`)
  console.log(`Field conflicts (existing value kept): ${report.conflicts.length}`)
  console.log(`Errors: ${report.errors.length}`)
  console.log(`\nReport: ${reportPath}`)

  if (report.errors.length > 0) {
    console.log("\nFirst errors:")
    for (const item of report.errors.slice(0, 10)) {
      console.log(`- ${item.csvName || item.contactId}: ${item.message}`)
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
