/**
 * Import Sep 12 2026 Square campaign donations onto Annual Fundraiser -
 * September 2026. Square "Payment / Donation Reason" values map to CRM
 * giving groups (campaign_groups + attributed_group_contact_id). The
 * general Sep 12 reason is campaign-only (no group).
 *
 *   node scripts/import-fundraiser-dinner-donations.mjs
 *   node scripts/import-fundraiser-dinner-donations.mjs --file "C:/Users/danan/Downloads/September12Donations.csv"
 *   node scripts/import-fundraiser-dinner-donations.mjs --execute
 *   node scripts/import-fundraiser-dinner-donations.mjs --link-recurring --execute
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * for --execute.
 */
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CAMPAIGN_ID = "74fc4ba9-a7f1-4aec-af12-a62909e32afc"
const DEFAULT_FILE = "C:/Users/danan/Downloads/September12Donations.csv"
const IMPORT_TAG = "FUNDRAISER_DINNER_DONATIONS_SEP2026_V1"
const GENERAL_CATEGORY_NAME = "General Donation"
const STAMP = new Date().toISOString().slice(0, 10)
const PAYMENT_BATCH_SIZE = 50

/**
 * Square donation reason → CRM giving group name.
 * `null` = general campaign gift (no group).
 * Groups listed in `createIfMissing` are created when absent.
 */
const REASON_TO_GROUP = {
  "Annual Fundraiser - Quran Institute for Ladies": {
    groupName: "Quran Institute for Ladies",
  },
  "Annual Fundraiser - Ladies Wednesday Halaqa": {
    groupName: "Wednesday Halaqa",
  },
  "Annual Fundraiser - Ladies Thursday Halaqa": {
    groupName: "Thursday Halaqa",
  },
  "Annual Fundraiser - CYP Usrat Al-Islah": {
    groupName: "CYP Usrat Al-Islah",
    createIfMissing: true,
  },
  "Annual Fundraiser - Education Dept.": {
    groupName: "Education Department",
  },
  "Annual Fundraiser - Tarbiya Dept.": {
    groupName: "Tarbiya",
    createIfMissing: true,
    departmentName: "Tarbiya",
  },
  "Annual Fundraiser - Center": {
    groupName: "Center",
    createIfMissing: true,
    departmentName: "Center",
  },
  "Annual Fundraiser - RSA": {
    groupName: "RSA",
  },
  "Annual Fundraiser - September 12, 2026": {
    groupName: null,
  },
}

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
    campaignId: DEFAULT_CAMPAIGN_ID,
    execute: false,
    linkRecurring: false,
    limit: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--execute") args.execute = true
    else if (arg === "--link-recurring") args.linkRecurring = true
    else if (arg === "--file") args.file = argv[++index]
    else if (arg === "--org") args.orgId = argv[++index]
    else if (arg === "--campaign") args.campaignId = argv[++index]
    else if (arg === "--limit") args.limit = Number(argv[++index])
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

function parseMoney(value) {
  const parsed = Number(normalizeText(value).replace(/[$,]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function addCalendarMonths(dateValue, months) {
  const plain = String(dateValue).slice(0, 10)
  const [year, month, day] = plain.split("-").map(Number)
  const next = new Date(year, month - 1 + months, day)
  const y = next.getFullYear()
  const m = String(next.getMonth() + 1).padStart(2, "0")
  const d = String(next.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseImportedRecurringFromMemo(memo) {
  const parts = String(memo || "").split("|")
  const recurringType = String(parts[3] || "").toUpperCase()
  const remarks = parts.slice(6).join("|")
  if (recurringType !== "MONTHLY" && !/\bmonthly\b/i.test(remarks)) return null
  return {
    frequency: "monthly",
    totalPayments: /one year/i.test(remarks) ? 12 : null,
    notes: remarks || "Square MONTHLY donation",
  }
}

async function linkImportedRecurringPlans(report) {
  const { data: payments, error } = await sb
    .from("payments")
    .select(
      "id, donor_id, contact_id, amount, payment_date, category_id, subcategory_id, campaign_id, memo, recurring_donation_plan_id, sender_name"
    )
    .eq("organization_id", args.orgId)
    .eq("campaign_id", args.campaignId)
    .ilike("memo", `${IMPORT_TAG}|%`)
    .is("recurring_donation_plan_id", null)

  if (error) throw new Error(`load payments for recurring link: ${error.message}`)

  const candidates = []
  for (const payment of payments || []) {
    const recurring = parseImportedRecurringFromMemo(payment.memo)
    if (!recurring || !payment.donor_id) continue
    candidates.push({ payment, recurring })
  }

  report.recurringCandidates = candidates.map(({ payment, recurring }) => ({
    name: payment.sender_name,
    amount: Number(payment.amount),
    frequency: recurring.frequency,
    totalPayments: recurring.totalPayments,
    notes: recurring.notes,
  }))

  if (!args.execute) {
    report.recurringPlansCreated = candidates.length
    return
  }

  report.recurringPlansCreated = 0
  report.paymentsLinkedToPlans = 0

  for (const { payment, recurring } of candidates) {
    const startDate = String(payment.payment_date).slice(0, 10)
    const endDate =
      recurring.totalPayments != null
        ? addCalendarMonths(startDate, recurring.totalPayments)
        : null
    const { data: plan, error: planError } = await sb
      .from("recurring_donation_plans")
      .insert({
        organization_id: args.orgId,
        donor_id: payment.donor_id,
        contact_id: payment.contact_id,
        campaign_id: payment.campaign_id,
        category_id: payment.category_id,
        subcategory_id: payment.subcategory_id,
        amount: payment.amount,
        frequency: recurring.frequency,
        status: "active",
        start_date: startDate,
        next_payment_date: addCalendarMonths(startDate, 1),
        end_date: endDate,
        total_payments: recurring.totalPayments,
        payments_made: 1,
        notes: recurring.notes,
        external_processor: "square",
      })
      .select("id")
      .single()

    if (planError) {
      report.errors.push({
        name: payment.sender_name,
        error: `recurring plan: ${planError.message}`,
      })
      continue
    }

    const { error: linkError } = await sb
      .from("payments")
      .update({ recurring_donation_plan_id: plan.id })
      .eq("id", payment.id)
      .eq("organization_id", args.orgId)

    if (linkError) {
      report.errors.push({
        name: payment.sender_name,
        error: `link payment: ${linkError.message}`,
      })
      continue
    }

    report.recurringPlansCreated += 1
    report.paymentsLinkedToPlans += 1
  }
}

function parsePaymentDate(value) {
  const text = normalizeText(value)
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
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
    normalizeEmail(row["Customer Email"]),
    parseMoney(row.Amount).toFixed(2),
    parsePaymentDate(row["Transaction Date"]),
    normalizeName(row["Payment / Donation Reason"]),
  ].join("|")
}

function rowImportHash(row) {
  return createHash("sha256").update(rowDedupeKey(row)).digest("hex").slice(0, 12)
}

function createPublicToken() {
  return randomUUID().replace(/-/g, "")
}

function buildContactIndexes(contacts) {
  const byEmail = new Map()
  const byPhone = new Map()
  const byName = new Map()

  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() === "group") continue

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

function sanitizeRow(row) {
  const displayName = resolveDisplayName(row)
  const amount = parseMoney(row.Amount)
  const paymentDate = parsePaymentDate(row["Transaction Date"])
  const reason = normalizeText(row["Payment / Donation Reason"])

  if (
    !displayName ||
    String(row.Status || "").toLowerCase() !== "succeeded" ||
    String(row["Transaction Type"] || "").toUpperCase() !== "CREDIT" ||
    amount <= 0 ||
    !paymentDate ||
    !reason
  ) {
    return null
  }

  if (!(reason in REASON_TO_GROUP)) {
    return { invalid: true, displayName, amount, paymentDate, reason }
  }

  return {
    ...row,
    displayName,
    amount,
    paymentDate,
    reason,
    email: normalizeEmail(row["Customer Email"]) || null,
    phone: formatPhoneForStorage(row["Customer Phone"]),
    recurringType: normalizeText(row["Recurring Type"]) || "ONE_TIME",
    paymentMode: normalizeText(row["Payment Mode"]) || null,
    cardLast4: normalizeText(row["Card Last 4 Digits"]) || null,
    remarks: normalizeText(row["Payment Remarks"]) || null,
    mapping: REASON_TO_GROUP[reason],
  }
}

loadEnv()

const args = parseArgs(process.argv.slice(2))

if (!args.linkRecurring && !existsSync(args.file)) {
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
      else if (filter.op === "ilike") query = query.ilike(filter.col, filter.val)
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
  if (args.linkRecurring) {
    const report = {
      execute: args.execute,
      linkRecurring: true,
      organizationId: args.orgId,
      campaignId: args.campaignId,
      recurringCandidates: [],
      recurringPlansCreated: 0,
      paymentsLinkedToPlans: 0,
      errors: [],
    }
    await linkImportedRecurringPlans(report)
    const reportsDir = resolve(root, "scripts", "reports")
    mkdirSync(reportsDir, { recursive: true })
    const reportPath = resolve(
      reportsDir,
      args.execute
        ? `fundraiser-dinner-recurring-link-execute.json`
        : `fundraiser-dinner-recurring-link-dry-run.json`
    )
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    console.log(`\nReport written to ${reportPath}`)
    if (!args.execute) {
      console.log("\nDry run only. Re-run with --link-recurring --execute to create plans.")
    }
    return
  }
  const parsed = Papa.parse(readFileSync(args.file, "utf8").replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    console.warn("CSV parse warnings:", parsed.errors.slice(0, 5))
  }

  const invalidReasons = []
  let rows = []
  for (const raw of parsed.data) {
    const row = sanitizeRow(raw)
    if (!row) continue
    if (row.invalid) {
      invalidReasons.push({
        name: row.displayName,
        amount: row.amount,
        reason: row.reason,
      })
      continue
    }
    rows.push(row)
  }

  if (args.limit) rows = rows.slice(0, args.limit)

  const report = {
    execute: args.execute,
    file: args.file,
    organizationId: args.orgId,
    campaignId: args.campaignId,
    campaignName: null,
    csvRowsParsed: parsed.data.length,
    eligibleRows: rows.length,
    skippedZeroOrInvalid: parsed.data.length - rows.length - invalidReasons.length,
    unknownReasons: invalidReasons,
    skippedCsvDuplicates: 0,
    skippedAlreadyImported: 0,
    groupsCreated: 0,
    campaignGroupsCreated: 0,
    fundsCreated: 0,
    contactsMatched: 0,
    contactsCreated: 0,
    donorsCreated: 0,
    paymentsCreated: 0,
    affiliationsSynced: 0,
    totalsByReason: {},
    monthlyRows: 0,
    monthlyAmount: 0,
    errors: [],
    samples: [],
  }

  if (invalidReasons.length > 0) {
    report.errors.push({
      error: `Unknown Square donation reasons: ${[
        ...new Set(invalidReasons.map((row) => row.reason)),
      ].join("; ")}`,
    })
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

  const { data: campaign, error: campaignError } = await sb
    .from("campaigns")
    .select("id, name, organization_id")
    .eq("id", args.campaignId)
    .eq("organization_id", args.orgId)
    .maybeSingle()

  if (campaignError) throw new Error(`campaign: ${campaignError.message}`)
  if (!campaign) {
    throw new Error(`Campaign ${args.campaignId} not found for this organization`)
  }
  report.campaignName = campaign.name

  const [contacts, donors, categories, subcategories, departments, existingCampaignGroups] =
    await Promise.all([
      fetchAll("contacts", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("donors", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("donation_categories", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("donation_subcategories", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("departments", [{ op: "eq", col: "organization_id", val: args.orgId }]),
      fetchAll("campaign_groups", [
        { op: "eq", col: "organization_id", val: args.orgId },
        { op: "eq", col: "campaign_id", val: args.campaignId },
      ]),
    ])

  const { data: taggedPayments, error: taggedError } = await sb
    .from("payments")
    .select("id, memo")
    .eq("organization_id", args.orgId)
    .like("memo", `${IMPORT_TAG}|%`)

  if (taggedError) throw new Error(`payments: ${taggedError.message}`)

  const importedRowHashes = new Set()
  for (const payment of taggedPayments || []) {
    const hashMatch = String(payment.memo || "").match(
      new RegExp(`${IMPORT_TAG}\\|([a-f0-9]{12})`)
    )
    if (hashMatch) importedRowHashes.add(hashMatch[1])
  }

  const rowsToImport = []
  for (const row of uniqueRows) {
    const hash = rowImportHash(row)
    if (importedRowHashes.has(hash)) {
      report.skippedAlreadyImported += 1
      continue
    }
    rowsToImport.push({ row, hash })
  }

  const contactIndexes = buildContactIndexes(contacts)
  const groupContactsByName = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() !== "group") continue
    groupContactsByName.set(normalizeName(contact.full_name), contact)
  }

  const departmentByName = new Map(
    departments.map((department) => [normalizeName(department.name), department])
  )
  const campaignGroupByOrgGroupId = new Map()
  const campaignGroupByName = new Map()
  for (const group of existingCampaignGroups) {
    if (group.organizational_group_id) {
      campaignGroupByOrgGroupId.set(group.organizational_group_id, group)
    }
    campaignGroupByName.set(normalizeName(group.name), group)
  }

  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor])
  )

  const categoryByName = new Map(
    categories.map((category) => [normalizeName(category.name), category])
  )
  const fundByName = new Map(
    subcategories.map((fund) => [normalizeName(fund.name), fund])
  )

  async function ensureCategory(name) {
    const key = normalizeName(name)
    if (categoryByName.has(key)) return categoryByName.get(key)
    if (!args.execute) {
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

  async function ensureGroupContact(mapping) {
    if (!mapping.groupName) return null
    const key = normalizeName(mapping.groupName)
    if (groupContactsByName.has(key)) return groupContactsByName.get(key)

    if (!mapping.createIfMissing) {
      throw new Error(`Giving group not found: ${mapping.groupName}`)
    }

    const department = mapping.departmentName
      ? departmentByName.get(normalizeName(mapping.departmentName))
      : null

    const payload = {
      organization_id: args.orgId,
      full_name: mapping.groupName,
      contact_type: "group",
      status: "active",
      giving_group_kind: "group_donation",
      linked_department_id: department?.id ?? null,
    }

    if (!args.execute) {
      report.groupsCreated += 1
      const placeholder = { id: `dry-run:group:${key}`, ...payload }
      groupContactsByName.set(key, placeholder)
      return placeholder
    }

    const { data, error } = await sb
      .from("contacts")
      .insert(payload)
      .select("id, full_name, contact_type, linked_department_id")
      .single()
    if (error) throw new Error(`group contact insert (${mapping.groupName}): ${error.message}`)
    groupContactsByName.set(key, data)
    report.groupsCreated += 1
    return data
  }

  async function ensureCampaignGroup(groupContact) {
    if (!groupContact) return null
    if (campaignGroupByOrgGroupId.has(groupContact.id)) {
      return campaignGroupByOrgGroupId.get(groupContact.id)
    }
    const nameKey = normalizeName(groupContact.full_name)
    if (campaignGroupByName.has(nameKey)) {
      return campaignGroupByName.get(nameKey)
    }

    const payload = {
      organization_id: args.orgId,
      campaign_id: args.campaignId,
      name: groupContact.full_name,
      organizational_group_id: String(groupContact.id).startsWith("dry-run:")
        ? null
        : groupContact.id,
      lead_contact_id: null,
      goal_amount: null,
      description: `Square group giving for ${campaign.name}`,
      public_token: createPublicToken(),
      status: "active",
      public_progress_enabled: true,
      link_active: true,
    }

    if (!args.execute) {
      report.campaignGroupsCreated += 1
      const placeholder = { id: `dry-run:campaign-group:${nameKey}`, ...payload }
      campaignGroupByOrgGroupId.set(groupContact.id, placeholder)
      campaignGroupByName.set(nameKey, placeholder)
      return placeholder
    }

    const { data, error } = await sb
      .from("campaign_groups")
      .insert(payload)
      .select("id, name, organizational_group_id")
      .single()
    if (error) throw new Error(`campaign_groups insert (${payload.name}): ${error.message}`)
    campaignGroupByOrgGroupId.set(groupContact.id, data)
    campaignGroupByName.set(nameKey, data)
    report.campaignGroupsCreated += 1
    return data
  }

  const category = await ensureCategory(GENERAL_CATEGORY_NAME)
  const fund = await ensureFund(campaign.name, category.id)

  const groupContactByReason = new Map()
  const campaignGroupByReason = new Map()
  const uniqueMappings = new Map()
  for (const row of uniqueRows) {
    uniqueMappings.set(row.reason, row.mapping)
  }
  for (const [reason, mapping] of uniqueMappings) {
    const groupContact = await ensureGroupContact(mapping)
    groupContactByReason.set(reason, groupContact)
    campaignGroupByReason.set(reason, await ensureCampaignGroup(groupContact))
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
      const groupContact = groupContactByReason.get(row.reason) || null
      const campaignGroup = campaignGroupByReason.get(row.reason) || null
      const memoParts = [
        IMPORT_TAG,
        hash,
        row.reason,
        row.recurringType,
        row.paymentMode,
        row.cardLast4 ? `last4:${row.cardLast4}` : null,
        row.remarks,
      ].filter(Boolean)

      paymentPayloads.push({
        organization_id: args.orgId,
        donor_id: donor.id,
        contact_id: contact.id,
        amount: row.amount,
        payment_date: row.paymentDate,
        source: "import",
        source_type: "import",
        status: "unallocated",
        sender_name: row.displayName,
        category_id: category.id,
        subcategory_id: fund.id,
        campaign_id: args.campaignId,
        campaign_group_id:
          campaignGroup && !String(campaignGroup.id).startsWith("dry-run:")
            ? campaignGroup.id
            : null,
        attributed_group_contact_id:
          groupContact && !String(groupContact.id).startsWith("dry-run:")
            ? groupContact.id
            : null,
        memo: memoParts.join("|"),
        is_verified: true,
      })

      if (row.recurringType === "MONTHLY") {
        report.monthlyRows += 1
        report.monthlyAmount += row.amount
      }

      const reasonTotals = report.totalsByReason[row.reason] || { n: 0, amount: 0 }
      reasonTotals.n += 1
      reasonTotals.amount += row.amount
      report.totalsByReason[row.reason] = reasonTotals

      if (contact.id && !String(contact.id).startsWith("dry-run:")) {
        affectedContactIds.add(contact.id)
      }

      if (report.samples.length < 10) {
        report.samples.push({
          name: row.displayName,
          amount: row.amount,
          date: row.paymentDate,
          reason: row.reason,
          group: row.mapping.groupName,
          remarks: row.remarks,
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

    await linkImportedRecurringPlans(report)
  } else {
    report.paymentsCreated = paymentPayloads.length
  }

  report.rowsQueued = rowsToImport.length
  report.totalAmount = paymentPayloads.reduce((sum, payment) => sum + Number(payment.amount), 0)

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportName = args.execute
    ? `fundraiser-dinner-donations-sep2026-execute.json`
    : `fundraiser-dinner-donations-sep2026-dry-run.json`
  const reportPath = resolve(reportsDir, reportName)
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
