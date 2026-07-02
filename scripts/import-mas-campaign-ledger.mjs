/**
 * Import MAS campaign ledger CSV (pledges + historical payments) into canonical tables.
 *
 * Usage:
 *   node scripts/import-mas-campaign-ledger.mjs --file "C:/path/All Campaigns.csv"
 *   node scripts/import-mas-campaign-ledger.mjs --file "..." --campaign "December 2023"
 *   node scripts/import-mas-campaign-ledger.mjs --file "..." --execute
 *   node scripts/import-mas-campaign-ledger.mjs --file "..." --execute --create-campaigns
 *   node scripts/import-mas-campaign-ledger.mjs --file "..." --payments-only --execute --create-campaigns
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "MAS_CAMPAIGN_LEDGER_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

const PAYMENT_SOURCE_CHANNELS = new Set([
  "cash",
  "check",
  "zelle",
  "venmo",
  "paypal",
  "stripe",
  "import",
  "manual",
])

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
    file: null,
    execute: false,
    createCampaigns: false,
    paymentsOnly: false,
    campaign: null,
    limit: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--execute") args.execute = true
    else if (arg === "--create-campaigns") args.createCampaigns = true
    else if (arg === "--payments-only") args.paymentsOnly = true
    else if (arg === "--file") args.file = argv[++index]
    else if (arg === "--campaign") args.campaign = argv[++index]
    else if (arg === "--limit") args.limit = Number(argv[++index])
  }

  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

const LEDGER_SUMMARY_ROW_NAMES = new Set(["total", "subtotal", "grand total"])
const LEDGER_BATCH_DEPOSIT_NAMES = new Set(["square"])

/** CSV spellings → canonical campaign name in the database */
const CAMPAIGN_NAME_ALIASES = new Map([["ramadan2025", "Ramadan 2025"]])

function resolveCampaignDisplayName(name) {
  const text = normalizeText(name)
  if (!text) return text
  const compact = normalizeName(text).replace(/\s/g, "")
  return CAMPAIGN_NAME_ALIASES.get(compact) || text
}

function isLedgerBatchDepositName(name) {
  return LEDGER_BATCH_DEPOSIT_NAMES.has(normalizeName(name))
}

function isLedgerSummaryRowName(name) {
  return LEDGER_SUMMARY_ROW_NAMES.has(normalizeName(name))
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
  return normalizeText(value).toLowerCase()
}

function normalizePhone(value) {
  return normalizeText(value).replace(/\D/g, "")
}

function parseMoney(value) {
  const cleaned = normalizeText(value).replace(/[$,]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Read the first positive amount from a row across possible column headers. */
function firstPositiveAmount(row, keys) {
  for (const key of keys) {
    if (row[key] === undefined || row[key] === "") continue
    const amount = parseMoney(row[key])
    if (amount > 0) return amount
  }
  return 0
}

function normalizeImportRow(row) {
  const normalized = { ...row }
  if (!normalizeText(normalized.Name) && normalizeText(normalized["Donor Name"])) {
    normalized.Name = normalizeText(normalized["Donor Name"])
  }
  if (!normalizeText(normalized.Group) && normalizeText(normalized["Group Name"])) {
    normalized.Group = normalizeText(normalized["Group Name"])
  }
  return normalized
}

/**
 * Ledger column semantics (MAS spreadsheet):
 * - Pledge: explicit commitment (may be paid down over time)
 * - Cash / Checks: direct payments
 * - One-time / CC: one-time card payment toward a pledge
 * - Recurring / CC+: installment payments toward a pledge
 *
 * If Pledge is blank but a payment column has value, treat as an implicit
 * fulfilled pledge equal to total payments on the row (no outstanding balance).
 */
function getLedgerAmounts(row, options = {}) {
  const paymentsOnly = Boolean(options.paymentsOnly)
  const pledge = parseMoney(row.Pledge)
  const cash = parseMoney(row.Cash)
  const checks = parseMoney(row.Checks)
  let oneTime = firstPositiveAmount(row, ["One-time", "One Time", "CC", "One-Time"])
  const recurring = firstPositiveAmount(row, ["Recurring", "CC+", "CC +"])
  const totalReceived = parseMoney(row["Total Received"])
  const totalColumn = parseMoney(row.Total)
  let totalPaid = cash + checks + oneTime + recurring
  if (totalPaid <= 0 && totalReceived > 0) {
    oneTime = totalReceived
    totalPaid = totalReceived
  } else if (totalPaid <= 0 && totalColumn > 0) {
    oneTime = totalColumn
    totalPaid = totalColumn
  }
  const effectivePledge = paymentsOnly ? 0 : pledge > 0 ? pledge : totalPaid

  return {
    pledge,
    cash,
    checks,
    oneTime,
    recurring,
    totalPaid,
    effectivePledge,
  }
}

function resolvePledgeFrequency(amounts) {
  if (amounts.pledge > 0 && amounts.recurring > 0) return "monthly"
  return "one_time"
}

function resolvePledgeStatus(amounts) {
  if (amounts.effectivePledge <= 0) return "open"
  if (amounts.totalPaid >= amounts.effectivePledge) return "fulfilled"
  if (amounts.totalPaid > 0) return "partial"
  return "open"
}

function parsePaymentDate(value) {
  const text = normalizeText(value)
  if (!text) return null

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const month = slash[1].padStart(2, "0")
    const day = slash[2].padStart(2, "0")
    return `${slash[3]}-${month}-${day}`
  }

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function normalizePaymentSource(displayName, columnKind) {
  if (columnKind === "cash") return "cash"
  if (columnKind === "checks") return "check"

  const raw = normalizeText(displayName)
  if (!raw) return columnKind === "recurring" ? "stripe" : "manual"

  const lower = raw.toLowerCase()
  if (PAYMENT_SOURCE_CHANNELS.has(lower)) return lower
  if (lower.includes("credit card")) return "stripe"
  if (lower.includes("ach") || lower.includes("wire")) return "manual"
  if (lower.includes("check")) return "check"
  if (lower.includes("zelle")) return "zelle"
  if (lower.includes("stripe")) return "stripe"
  if (lower.includes("paypal")) return "paypal"
  if (lower.includes("venmo")) return "venmo"
  if (lower.includes("cash")) return "cash"
  return "manual"
}

function isLedgerGroupName(name) {
  const normalized = normalizeName(name)
  if (!normalized) return false

  const patterns = [
    "halaqa",
    "halqa",
    "halaqah",
    "committee",
    " circle",
    "youth group",
    "sisters group",
    "brothers group",
  ]

  if (patterns.some((pattern) => normalized.includes(pattern))) {
    return true
  }

  return /\bgroup\b/.test(normalized) && !/\b(inc|llc|corp|ltd|market)\b/.test(normalized)
}

function detectContactType(row) {
  const name = normalizeText(row.Name)
  const primary = normalizeText(row["Primary Contact"])
  const primaryName = primary.split(/[?,]/)[0].trim()

  if (isLedgerGroupName(name)) {
    return "group"
  }

  if (
    primaryName &&
    normalizeNameForMatch(primaryName) !== normalizeNameForMatch(name.split("/")[0])
  ) {
    return "organization"
  }

  if (
    /\b(inc|llc|corp|ltd|market|cafe|academy|msaada|dynamics|solar|labs)\b/i.test(name)
  ) {
    return "organization"
  }

  return "individual"
}

function buildRowKey(rowIndex, row) {
  const campaign = normalizeText(row.Campaign)
  const name = normalizeNameForMatch(row.Name)
  const group = normalizeNameForMatch(row.Group)
  const phone = normalizePhone(row.phone)
  const amounts = getLedgerAmounts(row, { paymentsOnly: args.paymentsOnly })
  const payload = [
    rowIndex,
    campaign,
    name,
    group,
    phone,
    amounts.pledge.toFixed(2),
    amounts.cash.toFixed(2),
    amounts.checks.toFixed(2),
    amounts.oneTime.toFixed(2),
    amounts.recurring.toFixed(2),
  ].join("|")

  const hash = createHash("sha1").update(payload).digest("hex").slice(0, 12)
  return `${IMPORT_TAG}|${hash}`
}

function buildNotes(row) {
  const parts = [
    normalizeText(row.Group),
    normalizeText(row.Notes),
    normalizeText(row["Primary Contact"])
      ? `Primary contact: ${normalizeText(row["Primary Contact"])}`
      : "",
  ].filter(Boolean)

  return parts.join(" | ")
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

loadEnvLocal()

const args = parseArgs(process.argv.slice(2))

if (!args.file) {
  console.error(
    "Usage: node scripts/import-mas-campaign-ledger.mjs --file <path> [--campaign <name>] [--payments-only] [--execute] [--create-campaigns]"
  )
  process.exit(1)
}

if (!existsSync(args.file)) {
  console.error(`File not found: ${args.file}`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
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

function buildContactIndexes(contacts) {
  const byEmail = new Map()
  const byPhone = new Map()
  const byName = new Map()

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = normalizeNameForMatch(contact.full_name)

    if (email) byEmail.set(email, contact)
    if (phone) byPhone.set(phone, contact)
    if (nameKey) {
      const list = byName.get(nameKey) || []
      list.push(contact)
      byName.set(nameKey, list)
    }
  }

  return { byEmail, byPhone, byName }
}

function findContactMatch(row, indexes, options = {}) {
  const allowedTypes = options.individualsOnly
    ? new Set(["individual"])
    : null

  function isAllowed(contact) {
    return !allowedTypes || allowedTypes.has(contact.contact_type)
  }

  const email = normalizeEmail(row.Email)
  const phone = normalizePhone(row.phone)
  const nameKey = normalizeNameForMatch(row.Name)

  if (email && indexes.byEmail.has(email)) {
    const contact = indexes.byEmail.get(email)
    if (isAllowed(contact)) {
      return { contact, reason: "email" }
    }
  }

  if (phone && indexes.byPhone.has(phone)) {
    const contact = indexes.byPhone.get(phone)
    if (isAllowed(contact)) {
      return { contact, reason: "phone" }
    }
  }

  const exactNameMatches = (indexes.byName.get(nameKey) || []).filter(isAllowed)
  if (exactNameMatches.length === 1) {
    return { contact: exactNameMatches[0], reason: "exact_name" }
  }

  if (phone && exactNameMatches.length > 1) {
    const phoneMatch = exactNameMatches.find((contact) => normalizePhone(contact.phone) === phone)
    if (phoneMatch) return { contact: phoneMatch, reason: "name+phone" }
  }

  let best = null
  let bestScore = 0
  for (const candidates of indexes.byName.values()) {
    for (const contact of candidates) {
      if (!isAllowed(contact)) continue
      const score = scoreNameMatch(row.Name, contact.full_name)
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

  let rows = parsed.data.map((row) => normalizeImportRow(row))
  if (args.campaign) {
    rows = rows.filter((row) => normalizeText(row.Campaign) === args.campaign)
  }
  if (args.limit) {
    rows = rows.slice(0, args.limit)
  }

  const report = {
    mode: args.execute ? "execute" : "dry-run",
    paymentsOnly: args.paymentsOnly,
    file: args.file,
    campaignFilter: args.campaign,
    rowCount: rows.length,
    skippedEmpty: 0,
    skippedSummary: 0,
    skippedDuplicate: 0,
    contactsMatched: 0,
    contactsCreated: 0,
    groupsMatched: 0,
    groupsCreated: 0,
    groupMembersLinked: 0,
    donorsCreated: 0,
    campaignsCreated: 0,
    pledgesCreated: 0,
    paymentsCreated: 0,
    ambiguousMatches: [],
    errors: [],
    samples: [],
  }

  const orgIds = [...new Set(rows.map((row) => normalizeText(row.organization_id) || DEFAULT_ORG_ID))]
  if (orgIds.length !== 1) {
    console.error("Expected a single organization_id in file:", orgIds)
    process.exit(1)
  }

  const orgId = orgIds[0]
  const contacts = await fetchAll("contacts", [{ op: "eq", col: "organization_id", val: orgId }])
  const donors = await fetchAll("donors", [{ op: "eq", col: "organization_id", val: orgId }])
  const campaigns = await fetchAll("campaigns", [{ op: "eq", col: "organization_id", val: orgId }])

  const contactIndexes = buildContactIndexes(contacts)
  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor])
  )
  const campaignByName = new Map(
    campaigns.map((campaign) => [normalizeName(campaign.name), campaign])
  )

  const { data: existingTaggedPledges } = await sb
    .from("pledges")
    .select("id, notes")
    .eq("organization_id", orgId)
    .like("notes", `${IMPORT_TAG}|%`)

  const { data: existingTaggedPayments } = await sb
    .from("payments")
    .select("id, memo")
    .eq("organization_id", orgId)
    .like("memo", `${IMPORT_TAG}|%`)

  const importedRowKeys = new Set(
    [...(existingTaggedPledges || []), ...(existingTaggedPayments || [])]
      .map((row) => {
        const text = String(row.notes || row.memo || "")
        const match = text.match(new RegExp(`${IMPORT_TAG}\\|[a-f0-9]{12}`))
        return match?.[0] || null
      })
      .filter(Boolean)
  )

  const pendingContacts = new Map()
  const pendingGroups = new Map()
  const groupByName = new Map(
    contacts
      .filter((contact) => contact.contact_type === "group")
      .map((contact) => [normalizeName(contact.full_name), contact])
  )

  function rememberContact(contact) {
    contacts.push(contact)
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = normalizeNameForMatch(contact.full_name)
    if (email) contactIndexes.byEmail.set(email, contact)
    if (phone) contactIndexes.byPhone.set(phone, contact)
    if (nameKey) contactIndexes.byName.set(nameKey, [contact])
  }

  async function resolveCampaign(campaignName) {
    const displayName = resolveCampaignDisplayName(campaignName)
    const key = normalizeName(displayName)
    if (campaignByName.has(key)) return campaignByName.get(key)

    if (!args.createCampaigns) {
      throw new Error(`Campaign not found: ${campaignName} (use --create-campaigns)`)
    }

    if (!args.execute) {
      report.campaignsCreated += 1
      const placeholder = { id: `dry-run:${displayName}`, name: displayName }
      campaignByName.set(key, placeholder)
      return placeholder
    }

    const { data, error } = await sb
      .from("campaigns")
      .insert({
        organization_id: orgId,
        name: displayName,
        status: "active",
      })
      .select("id, name")
      .single()

    if (error) throw new Error(`campaign insert (${campaignName}): ${error.message}`)
    campaignByName.set(key, data)
    report.campaignsCreated += 1
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
        organization_id: orgId,
        contact_id: contact.id,
        full_name: contact.full_name,
        email: contact.email,
        phone: contact.phone,
        donor_type: contact.contact_type === "organization" ? "organization" : "individual",
        status: "active",
      })
      .select("id, contact_id")
      .single()

    if (error) throw new Error(`donor insert (${contact.full_name}): ${error.message}`)
    donorByContactId.set(contact.id, data)
    report.donorsCreated += 1
    return data
  }

  async function ensureContact(row, options = {}) {
    const displayName = normalizeText(row.Name)
    const pendingKey = [
      normalizeNameForMatch(displayName),
      normalizePhone(row.phone),
      normalizeEmail(row.Email),
    ].join("|")

    if (pendingContacts.has(pendingKey)) {
      return pendingContacts.get(pendingKey)
    }

    const match = findContactMatch(row, contactIndexes, {
      individualsOnly: Boolean(options.forceIndividual),
    })
    if (match) {
      report.contactsMatched += 1
      if (match.reason.startsWith("fuzzy_name")) {
        report.ambiguousMatches.push({
          csvName: displayName,
          matchedName: match.contact.full_name,
          reason: match.reason,
        })
      }
      pendingContacts.set(pendingKey, match.contact)
      return match.contact
    }

    const contactType = options.forceIndividual ? "individual" : detectContactType(row)
    const payload = {
      organization_id: orgId,
      full_name: displayName,
      email: normalizeEmail(row.Email) || null,
      phone: normalizeText(row.phone) || null,
      contact_type: contactType,
      status: "active",
    }

    if (!args.execute) {
      report.contactsCreated += 1
      const placeholder = { id: `dry-run:contact:${pendingKey}`, ...payload }
      rememberContact(placeholder)
      pendingContacts.set(pendingKey, placeholder)
      return placeholder
    }

    const { data, error } = await sb.from("contacts").insert(payload).select("*").single()
    if (error) throw new Error(`contact insert (${displayName}): ${error.message}`)
    rememberContact(data)
    pendingContacts.set(pendingKey, data)
    report.contactsCreated += 1
    return data
  }

  async function ensureGroupContact(groupName) {
    const displayName = normalizeText(groupName)
    const key = normalizeName(displayName)
    if (!displayName) {
      throw new Error("Group Name is required for payments-only import rows")
    }

    if (pendingGroups.has(key)) {
      return pendingGroups.get(key)
    }

    if (groupByName.has(key)) {
      const existing = groupByName.get(key)
      report.groupsMatched += 1
      pendingGroups.set(key, existing)
      return existing
    }

    const payload = {
      organization_id: orgId,
      full_name: displayName,
      contact_type: "group",
      status: "active",
    }

    if (!args.execute) {
      report.groupsCreated += 1
      const placeholder = { id: `dry-run:group:${key}`, ...payload }
      groupByName.set(key, placeholder)
      rememberContact(placeholder)
      pendingGroups.set(key, placeholder)
      return placeholder
    }

    const { data, error } = await sb.from("contacts").insert(payload).select("*").single()
    if (error) throw new Error(`group contact insert (${displayName}): ${error.message}`)
    groupByName.set(key, data)
    rememberContact(data)
    pendingGroups.set(key, data)
    report.groupsCreated += 1
    return data
  }

  async function linkGroupMember(groupContactId, memberContactId) {
    if (!args.execute) {
      report.groupMembersLinked += 1
      return
    }

    const { error } = await sb.from("contact_group_members").upsert(
      {
        organization_id: orgId,
        group_contact_id: groupContactId,
        member_contact_id: memberContactId,
        status: "active",
      },
      { onConflict: "group_contact_id,member_contact_id" }
    )

    if (error) throw new Error(`group member link: ${error.message}`)
    report.groupMembersLinked += 1
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowKey = buildRowKey(index + 2, row)
    const campaignName = resolveCampaignDisplayName(normalizeText(row.Campaign))
    const amounts = getLedgerAmounts(row, { paymentsOnly: args.paymentsOnly })
    const {
      pledge: pledgeAmount,
      cash: cashAmount,
      checks: checksAmount,
      oneTime: oneTimeAmount,
      recurring: recurringAmount,
      totalPaid,
      effectivePledge: effectivePledgeAmount,
    } = amounts
    const paymentDate = parsePaymentDate(row.payment_date) || "2023-12-31"

    if (!campaignName || !normalizeText(row.Name)) {
      report.skippedEmpty += 1
      continue
    }

    if (isLedgerSummaryRowName(row.Name)) {
      report.skippedSummary += 1
      continue
    }

    if (args.paymentsOnly) {
      if (totalPaid <= 0) {
        report.skippedEmpty += 1
        continue
      }
    } else if (effectivePledgeAmount <= 0 && totalPaid <= 0) {
      report.skippedEmpty += 1
      continue
    }

    if (importedRowKeys.has(rowKey)) {
      report.skippedDuplicate += 1
      continue
    }

    try {
      const campaign = await resolveCampaign(campaignName)
      const displayName = normalizeText(row.Name)

      if (isLedgerBatchDepositName(row.Name)) {
        const batchKey = normalizeName(row.Name)
        const paymentSpecs = []
        if (cashAmount > 0) {
          paymentSpecs.push({ kind: "cash", amount: cashAmount, source: "cash" })
        }
        if (checksAmount > 0) {
          paymentSpecs.push({
            kind: "checks",
            amount: checksAmount,
            source: normalizePaymentSource(row.Source, "checks"),
          })
        }
        if (oneTimeAmount > 0) {
          paymentSpecs.push({
            kind: "one-time",
            amount: oneTimeAmount,
            source: "manual",
          })
        }
        if (recurringAmount > 0) {
          paymentSpecs.push({
            kind: "recurring",
            amount: recurringAmount,
            source: normalizePaymentSource(row.Source, "recurring"),
          })
        }

        for (const spec of paymentSpecs) {
          const memo = `${rowKey}|batch|${batchKey}|${campaignName}`
          if (args.execute) {
            const { error } = await sb.from("payments").insert({
              organization_id: orgId,
              donor_id: null,
              contact_id: null,
              pledge_id: null,
              campaign_id: campaign.id,
              sender_name: null,
              amount: spec.amount,
              payment_date: `${paymentDate}T12:00:00`,
              source: spec.source,
              source_type: "import",
              status: "unallocated",
              memo,
              is_verified: false,
            })
            if (error) throw new Error(error.message)
          }
          report.paymentsCreated += 1
        }

        report.batchDepositsCreated = (report.batchDepositsCreated || 0) + 1
        if (report.samples.length < 8) {
          report.samples.push({
            rowKey,
            name: displayName,
            campaign: campaignName,
            batchDeposit: batchKey,
            payments: paymentSpecs.map((spec) => spec.amount),
          })
        }
        continue
      }

      const contact = await ensureContact(row, { forceIndividual: args.paymentsOnly })
      const donor = await ensureDonor(contact)
      const notes = buildNotes(row)
      let groupContact = null
      if (args.paymentsOnly && normalizeText(row.Group)) {
        groupContact = await ensureGroupContact(normalizeText(row.Group))
        await linkGroupMember(groupContact.id, contact.id)
      }

      let pledgeId = null
      if (!args.paymentsOnly && effectivePledgeAmount > 0) {
        const pledgeNotes = [rowKey, notes].filter(Boolean).join(" | ")
        const pledgeFrequency = resolvePledgeFrequency(amounts)
        const pledgeStatus = resolvePledgeStatus(amounts)

        if (args.execute) {
          const { data: pledge, error } = await sb
            .from("pledges")
            .insert({
              organization_id: orgId,
              donor_id: donor.id,
              campaign_id: campaign.id,
              amount_pledged: effectivePledgeAmount,
              pledge_date: paymentDate,
              pledge_type: pledgeFrequency,
              frequency: pledgeFrequency,
              status: pledgeStatus,
              notes: pledgeNotes,
            })
            .select("id")
            .single()

          if (error) throw new Error(error.message)
          pledgeId = pledge.id
        }

        report.pledgesCreated += 1
      }

      const paymentSpecs = []
      if (args.paymentsOnly) {
        paymentSpecs.push({
          kind: "one-time",
          amount: totalPaid,
          source: normalizePaymentSource(row.Source, "one-time"),
        })
      } else {
        if (cashAmount > 0) {
          paymentSpecs.push({ kind: "cash", amount: cashAmount, source: "cash" })
        }
        if (checksAmount > 0) {
          paymentSpecs.push({
            kind: "checks",
            amount: checksAmount,
            source: normalizePaymentSource(row.Source, "checks"),
          })
        }
        if (oneTimeAmount > 0) {
          paymentSpecs.push({
            kind: "one-time",
            amount: oneTimeAmount,
            source: normalizePaymentSource(row.Source, "one-time"),
          })
        }
        if (recurringAmount > 0) {
          paymentSpecs.push({
            kind: "recurring",
            amount: recurringAmount,
            source: normalizePaymentSource(row.Source, "recurring"),
          })
        }
      }

      for (const spec of paymentSpecs) {
        const memo = `${rowKey}|${spec.kind}|${campaignName}`
        const status = pledgeId ? "allocated" : "unallocated"

        if (!args.paymentsOnly && !pledgeId && totalPaid > 0) {
          report.warnings = report.warnings || []
          if (report.warnings.length < 20) {
            report.warnings.push({
              rowKey,
              name: displayName,
              message: "Payment row without pledge link (dry-run or insert failure)",
            })
          }
        }

        if (args.execute) {
          const { error } = await sb.from("payments").insert({
            organization_id: orgId,
            donor_id: donor.id,
            contact_id: contact.id,
            pledge_id: pledgeId,
            campaign_id: campaign.id,
            attributed_group_contact_id: groupContact?.id ?? null,
            sender_name: displayName,
            amount: spec.amount,
            payment_date: `${paymentDate}T12:00:00`,
            source: spec.source,
            source_type: "import",
            status,
            memo,
            is_verified: false,
          })

          if (error) throw new Error(error.message)
        }

        report.paymentsCreated += 1
      }

      if (report.samples.length < 8) {
        report.samples.push({
          rowKey,
          name: displayName,
          group: args.paymentsOnly ? normalizeText(row.Group) : undefined,
          campaign: campaignName,
          pledge: args.paymentsOnly ? undefined : pledgeAmount,
          effectivePledge: args.paymentsOnly ? undefined : effectivePledgeAmount,
          payments: paymentSpecs.map((spec) => spec.amount),
        })
      }
    } catch (error) {
      report.errors.push({
        row: index + 2,
        name: normalizeText(row.Name),
        campaign: campaignName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const hasGroupColumn = rows.some((row) => normalizeText(row.Group))
  const suffix = args.paymentsOnly
    ? hasGroupColumn
      ? "group-donations"
      : "one-time-donations"
    : args.campaign
      ? args.campaign.replace(/\s+/g, "-").toLowerCase()
      : "all"
  const reportPath = resolve(reportsDir, `mas-campaign-ledger-import-${suffix}-${stamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${reportPath}`)

  if (!args.execute) {
    console.log("\nDry run only. Re-run with --execute to import.")
    if (!args.createCampaigns) {
      console.log("If campaigns are missing, add --create-campaigns on execute.")
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
