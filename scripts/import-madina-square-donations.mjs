/**
 * Import MAS Square one-time / recurring donation payments from CSV.
 *
 * Usage:
 *   node scripts/import-madina-square-donations.mjs --file "C:/path/MadinaDonationsActive07032026.csv"
 *   node scripts/import-madina-square-donations.mjs --file "..." --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_FILE = "C:/Users/danan/Downloads/MadinaDonationsActive07032026.csv"
const IMPORT_TAG = "MADINA_SQUARE_DONATIONS_V1"
const CAMPAIGN_IMPORT_TAG = "MAS_CAMPAIGN_LEDGER_V1"
const STAMP = new Date().toISOString().slice(0, 10)
const PAYMENT_BATCH_SIZE = 100

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
    file: DEFAULT_FILE,
    orgId: DEFAULT_ORG_ID,
    execute: false,
    limit: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--execute") args.execute = true
    else if (arg === "--file") args.file = argv[++index]
    else if (arg === "--org") args.orgId = argv[++index]
    else if (arg === "--limit") args.limit = Number(argv[++index])
  }

  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeLabel(value) {
  return normalizeText(value).replace(/\s+/g, " ")
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

function parseMoney(value) {
  const parsed = Number(normalizeText(value).replace(/[$,]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function parsePaymentDate(value) {
  const text = normalizeText(value)
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function resolveDisplayName(row) {
  let name = normalizeText(row["Customer Name"])
  const email = normalizeEmail(row["Customer Email"])

  if (!name && email) {
    name = email.split("@")[0].replace(/[._-]+/g, " ").trim()
  }

  return name
}

function matchNameKey(row) {
  return normalizeNameForMatch(resolveDisplayName(row))
}

function rowDedupeKey(row) {
  return [
    matchNameKey(row),
    parseMoney(row.Amount).toFixed(2),
    parsePaymentDate(row["Transaction Date"]),
    normalizeName(row.Category),
    normalizeName(row.Fund || ""),
  ].join("|")
}

function campaignSkipKey(row) {
  return `${matchNameKey(row)}|${parseMoney(row.Amount).toFixed(2)}`
}

function rowImportHash(row) {
  return createHash("sha256").update(rowDedupeKey(row)).digest("hex").slice(0, 12)
}

function buildContactIndexes(contacts) {
  const byEmail = new Map()
  const byPhone = new Map()
  const byName = new Map()

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = normalizeNameForMatch(contact.full_name)

    if (email && !byEmail.has(email)) byEmail.set(email, contact)
    if (phone.length >= 7 && !byPhone.has(phone)) byPhone.set(phone, contact)
    if (nameKey) {
      const list = byName.get(nameKey) || []
      if (!list.some((item) => item.id === contact.id)) {
        list.push(contact)
        byName.set(nameKey, list)
      }
    }
  }

  return { byEmail, byPhone, byName }
}

function rememberContact(contact, indexes) {
  const email = normalizeEmail(contact.email)
  const phone = normalizePhone(contact.phone)
  const nameKey = normalizeNameForMatch(contact.full_name)

  if (email) indexes.byEmail.set(email, contact)
  if (phone.length >= 7) indexes.byPhone.set(phone, contact)
  if (nameKey) indexes.byName.set(nameKey, [contact])
}

function findContactMatch(row, indexes) {
  const email = normalizeEmail(row["Customer Email"])
  const phone = normalizePhone(row["Customer Phone"])
  const nameKey = normalizeNameForMatch(resolveDisplayName(row))

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

  return null
}

function sanitizeRow(row, orgId) {
  const displayName = resolveDisplayName(row)
  if (!displayName) return null

  const amount = parseMoney(row.Amount)
  const paymentDate = parsePaymentDate(row["Transaction Date"])
  const category = normalizeLabel(row.Category)

  if (
    row.Status !== "succeeded" ||
    row["Transaction Type"] !== "CREDIT" ||
    amount <= 0 ||
    !paymentDate ||
    !category
  ) {
    return null
  }

  return {
    ...row,
    displayName,
    amount,
    paymentDate,
    category,
    fund: normalizeLabel(row.Fund) || null,
    email: normalizeEmail(row["Customer Email"]) || null,
    phone: formatPhoneForStorage(row["Customer Phone"]),
  }
}

loadEnv()

const args = parseArgs(process.argv.slice(2))

if (!existsSync(args.file)) {
  console.error(`File not found: ${args.file}`)
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
      else if (filter.op === "like") query = query.like(filter.col, filter.val)
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

async function main() {
  const parsed = Papa.parse(readFileSync(args.file, "utf8"), {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    console.warn("CSV parse warnings:", parsed.errors.slice(0, 5))
  }

  let rows = parsed.data
    .map((row) => sanitizeRow(row, args.orgId))
    .filter(Boolean)

  if (args.limit) rows = rows.slice(0, args.limit)

  const report = {
    execute: args.execute,
    file: args.file,
    organizationId: args.orgId,
    csvRowsParsed: parsed.data.length,
    eligibleRows: rows.length,
    skippedZeroOrInvalid: parsed.data.length - rows.length,
    skippedCsvDuplicates: 0,
    skippedCampaignOverlap: 0,
    skippedAlreadyImported: 0,
    categoriesCreated: 0,
    fundsCreated: 0,
    contactsMatched: 0,
    contactsCreated: 0,
    donorsCreated: 0,
    paymentsCreated: 0,
    affiliationsSynced: 0,
    errors: [],
    samples: [],
  }

  const seenCsvKeys = new Set()
  const uniqueRows = []

  for (const row of rows) {
    const dedupeKey = rowDedupeKey(row)
    if (seenCsvKeys.has(dedupeKey)) {
      report.skippedCsvDuplicates += 1
      continue
    }
    seenCsvKeys.add(dedupeKey)
    uniqueRows.push(row)
  }

  const payments = await fetchAll("payments", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])

  const donors = await fetchAll("donors", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])

  const donorNameById = new Map()
  const contactIdsByDonorId = new Map()
  for (const donor of donors) {
    contactIdsByDonorId.set(donor.id, donor.contact_id)
    donorNameById.set(
      donor.id,
      normalizeNameForMatch(donor.full_name || "")
    )
  }

  const contacts = await fetchAll("contacts", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]))
  const contactIndexes = buildContactIndexes(contacts)
  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor])
  )

  const campaignSkipKeys = new Set()
  const importedRowHashes = new Set()

  for (const payment of payments) {
    if (payment.status === "voided") continue

    const memo = String(payment.memo || "")
    const hashMatch = memo.match(new RegExp(`${IMPORT_TAG}\\|([a-f0-9]{12})`))
    if (hashMatch) importedRowHashes.add(hashMatch[1])

    if (!memo.startsWith(CAMPAIGN_IMPORT_TAG)) continue

    const senderName = normalizeNameForMatch(payment.sender_name || "")
    const donorName =
      senderName ||
      donorNameById.get(payment.donor_id || "") ||
      normalizeNameForMatch(
        contactById.get(contactIdsByDonorId.get(payment.donor_id || "") || "")?.full_name || ""
      )
    const amount = Number(payment.amount).toFixed(2)
    if (donorName) campaignSkipKeys.add(`${donorName}|${amount}`)
  }

  const rowsToImport = []
  for (const row of uniqueRows) {
    const hash = rowImportHash(row)
    if (importedRowHashes.has(hash)) {
      report.skippedAlreadyImported += 1
      continue
    }

    if (campaignSkipKeys.has(campaignSkipKey(row))) {
      report.skippedCampaignOverlap += 1
      continue
    }

    rowsToImport.push({ row, hash })
  }

  const categories = await fetchAll("donation_categories", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])
  const subcategories = await fetchAll("donation_subcategories", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])

  const categoryByName = new Map(
    categories.map((category) => [normalizeName(category.name), category])
  )
  const fundByName = new Map(
    subcategories.map((fund) => [normalizeName(fund.name), fund])
  )
  const fundCategoryByName = new Map()

  for (const row of rowsToImport) {
    const categoryName = normalizeName(row.row.category)
    const fundName = normalizeName(row.row.fund || "")
    if (fundName) fundCategoryByName.set(fundName, categoryName)
  }

  async function ensureCategory(name) {
    const key = normalizeName(name)
    if (categoryByName.has(key)) return categoryByName.get(key)

    if (!args.execute) {
      report.categoriesCreated += 1
      const placeholder = { id: `dry-run:category:${key}`, name }
      categoryByName.set(key, placeholder)
      return placeholder
    }

    const { data, error } = await sb
      .from("donation_categories")
      .insert({
        organization_id: args.orgId,
        name,
        tax_deductible: true,
        is_active: true,
        show_on_website: true,
        show_on_kiosk: true,
      })
      .select("id, name")
      .single()

    if (error) throw new Error(`category insert (${name}): ${error.message}`)
    categoryByName.set(key, data)
    report.categoriesCreated += 1
    return data
  }

  async function ensureFund(name, categoryId) {
    const key = normalizeName(name)
    if (fundByName.has(key)) return fundByName.get(key)

    if (!args.execute) {
      report.fundsCreated += 1
      const placeholder = { id: `dry-run:fund:${key}`, name, category_id: categoryId }
      fundByName.set(key, placeholder)
      return placeholder
    }

    const { data, error } = await sb
      .from("donation_subcategories")
      .insert({
        organization_id: args.orgId,
        category_id: categoryId,
        name,
        is_active: true,
      })
      .select("id, name, category_id")
      .single()

    if (error) throw new Error(`fund insert (${name}): ${error.message}`)
    fundByName.set(key, data)
    report.fundsCreated += 1
    return data
  }

  const categoryNames = [...new Set(rowsToImport.map(({ row }) => row.category))]
  for (const categoryName of categoryNames) {
    await ensureCategory(categoryName)
  }

  const fundNames = [...fundCategoryByName.keys()]
  for (const fundNameKey of fundNames) {
    const categoryName = fundCategoryByName.get(fundNameKey)
    const category = categoryByName.get(categoryName)
    const fundLabel =
      subcategories.find((fund) => normalizeName(fund.name) === fundNameKey)?.name ||
      rowsToImport.find(({ row }) => normalizeName(row.fund || "") === fundNameKey)?.row.fund
    await ensureFund(fundLabel, category.id)
  }

  const pendingContacts = new Map()

  async function ensureContact(row) {
    const pendingKey = [
      matchNameKey(row),
      normalizePhone(row["Customer Phone"]),
      normalizeEmail(row["Customer Email"]),
    ].join("|")

    if (pendingContacts.has(pendingKey)) {
      return pendingContacts.get(pendingKey)
    }

    const match = findContactMatch(row, contactIndexes)
    if (match) {
      report.contactsMatched += 1
      pendingContacts.set(pendingKey, match.contact)
      return match.contact
    }

    const payload = {
      organization_id: args.orgId,
      full_name: row.displayName,
      email: row.email,
      phone: row.phone,
      contact_type: "individual",
      status: "active",
    }

    if (!args.execute) {
      report.contactsCreated += 1
      const placeholder = { id: `dry-run:contact:${pendingKey}`, ...payload }
      rememberContact(placeholder, contactIndexes)
      pendingContacts.set(pendingKey, placeholder)
      return placeholder
    }

    const { data: contactId, error: rpcError } = await sb.rpc("find_or_create_contact_for_org", {
      p_organization_id: args.orgId,
      p_full_name: payload.full_name,
      p_email: payload.email,
      p_phone: payload.phone,
      p_contact_type: payload.contact_type,
    })

    if (rpcError || !contactId) {
      throw new Error(rpcError?.message || `Could not create contact for ${payload.full_name}`)
    }

    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, contact_type, status")
      .eq("id", contactId)
      .single()

    if (error) throw new Error(error.message)
    rememberContact(data, contactIndexes)
    pendingContacts.set(pendingKey, data)
    report.contactsCreated += 1
    return data
  }

  async function ensureDonor(contact) {
    if (donorByContactId.has(contact.id)) return donorByContactId.get(contact.id)

    if (!args.execute) {
      report.donorsCreated += 1
      const placeholder = { id: `dry-run:donor:${contact.id}`, contact_id: contact.id }
      donorByContactId.set(contact.id, placeholder)
      return placeholder
    }

    const { data, error } = await sb
      .from("donors")
      .insert({
        organization_id: args.orgId,
        contact_id: contact.id,
        full_name: contact.full_name,
        email: contact.email,
        phone: contact.phone,
        donor_type: "individual",
        status: "active",
      })
      .select("id, contact_id")
      .single()

    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await sb
          .from("donors")
          .select("id, contact_id")
          .eq("organization_id", args.orgId)
          .eq("contact_id", contact.id)
          .maybeSingle()
        if (existing) {
          donorByContactId.set(contact.id, existing)
          return existing
        }
      }
      throw new Error(`donor insert (${contact.full_name}): ${error.message}`)
    }

    donorByContactId.set(contact.id, data)
    report.donorsCreated += 1
    return data
  }

  const paymentPayloads = []
  const affectedContactIds = new Set()

  for (const { row, hash } of rowsToImport) {
    try {
      const contact = await ensureContact(row)
      const donor = await ensureDonor(contact)
      const category = categoryByName.get(normalizeName(row.category))
      const fund = row.fund ? fundByName.get(normalizeName(row.fund)) : null

      paymentPayloads.push({
        organization_id: args.orgId,
        donor_id: donor.id,
        contact_id: contact.id,
        amount: row.amount,
        payment_date: `${row.paymentDate}T12:00:00`,
        source: "import",
        source_type: "import",
        status: "unallocated",
        sender_name: row.displayName,
        category_id: category?.id ?? null,
        subcategory_id: fund?.id ?? null,
        memo: `${IMPORT_TAG}|${hash}|${row.category}${row.fund ? `|${row.fund}` : ""}`,
        is_verified: false,
      })

      if (contact.id && !String(contact.id).startsWith("dry-run:")) {
        affectedContactIds.add(contact.id)
      }

      if (report.samples.length < 8) {
        report.samples.push({
          name: row.displayName,
          amount: row.amount,
          date: row.paymentDate,
          category: row.category,
          fund: row.fund,
        })
      }
    } catch (error) {
      report.errors.push({
        name: row.displayName,
        amount: row.amount,
        date: row.paymentDate,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (args.execute) {
    for (let index = 0; index < paymentPayloads.length; index += PAYMENT_BATCH_SIZE) {
      const batch = paymentPayloads.slice(index, index + PAYMENT_BATCH_SIZE)
      const { error } = await sb.from("payments").insert(batch)
      if (error) {
        report.errors.push({
          batch: `${index + 1}-${index + batch.length}`,
          error: error.message,
        })
      } else {
        report.paymentsCreated += batch.length
      }
    }

    for (const contactId of affectedContactIds) {
      const { error } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: args.orgId,
        p_contact_id: contactId,
      })
      if (error) {
        report.errors.push({
          contactId,
          error: `sync_contact_affiliations: ${error.message}`,
        })
      } else {
        report.affiliationsSynced += 1
      }
    }
  } else {
    report.paymentsCreated = paymentPayloads.length
  }

  report.rowsQueued = rowsToImport.length

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `madina-square-donations-import-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${reportPath}`)

  if (!args.execute) {
    console.log("\nDry run only. Re-run with --execute to import.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
