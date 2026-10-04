/**
 * Stripe transaction report → MAS DFW Annual Fundraiser - September 2026.
 *
 * One-time gifts land on the campaign one-time tab. A payment from someone
 * with an open campaign pledge is applied to that pledge instead. Recurring
 * charges that match a subscription already on this campaign are recorded
 * under that plan. Recurring charges with no pledge and no campaign
 * subscription are older plans and are skipped.
 *
 *   node scripts/import-september-2026-transactions.mjs
 *   node scripts/import-september-2026-transactions.mjs --execute
 */
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "54f5db10-02fe-433a-b91a-f90c16882a97"
const DEFAULT_CAMPAIGN_ID = "fa15246a-e80d-4d65-9bf4-a5af4051b821"
const DEFAULT_FILE = "C:/Users/danan/Downloads/PAYMENT_TRANSACTION_REPORT_2026-10-03.csv"
const IMPORT_TAG = "SEP2026_TRANSACTIONS_DFW_V1"
const CAMPAIGN_FUND = "Annual Fundraiser - September 2026"
const GENERAL_CATEGORY = "General Donation"
const PAYMENT_BATCH_SIZE = 50

const NAME_ALIASES = [
  ["gh abo farag", "ghada abofarag"],
  ["ghada abo farag", "ghada abofarag"],
]

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
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--execute") args.execute = true
    else if (arg === "--file") args.file = argv[++index]
    else if (arg === "--org") args.orgId = argv[++index]
    else if (arg === "--campaign") args.campaignId = argv[++index]
  }
  return args
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ""
  let inQuotes = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else inQuotes = false
      } else cell += char
    } else if (char === '"') inQuotes = true
    else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") cell += char
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .trim()
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(dr|mr|mrs|ms|sheikh)\s+/, "")
}

function canonicalName(value) {
  const name = normalizeName(value)
  for (const [left, right] of NAME_ALIASES) {
    if (name === left || name === right) return "ghada abofarag"
  }
  return name
}

function nameTokens(value) {
  return normalizeName(value).split(" ").filter(Boolean)
}

function tokensMatch(left, right) {
  return left === right || left === `al${right}` || right === `al${left}`
}

function namesMatch(leftName, rightName) {
  if (canonicalName(leftName) === canonicalName(rightName) && canonicalName(leftName)) return true
  const left = nameTokens(leftName)
  const right = nameTokens(rightName)
  if (!left.length || left.length !== right.length) return false
  return left.every((token, index) => tokensMatch(token, right[index]))
}

function normalizeEmail(value) {
  const text = normalizeText(value).toLowerCase()
  return text.includes("@") ? text : ""
}

function normalizePhone(value) {
  const digits = normalizeText(value).replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits.length >= 7 ? digits : ""
}

function money(value) {
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

function parseDate(value) {
  const text = normalizeText(value)
  if (!text) return null
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
  const months = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  }
  const named = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/)
  if (named) {
    const month = months[named[1].slice(0, 3).toLowerCase()]
    if (month) return `${named[3]}-${month}-${named[2].padStart(2, "0")}`
  }
  return null
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function isOrganizationName(name) {
  return /\b(llc|inc\.?|foundation|pharmacy|labs|market|mortgage|memorial|scouts|forum|society|association|relief)\b/i.test(
    name
  )
}

function mapReason(reason) {
  const text = normalizeText(reason)
  const key = text.toLowerCase()
  if (key.includes("wednesday halaqa")) return { kind: "group", groupName: "Wednesday Halaqa" }
  if (key.includes("thursday halaqa")) return { kind: "group", groupName: "Thursday Halaqa" }
  if (key.includes("quran institute")) return { kind: "group", groupName: "Quran Institute for Ladies" }
  if (key.includes("tarbiya")) return { kind: "group", groupName: "Tarbiya" }
  if (key.includes("education")) return { kind: "group", groupName: "Education" }
  if (key.includes("al-islah") || key.includes("al islah")) {
    return { kind: "group", groupName: "CYP Usrat Al-Islah" }
  }
  if (key === "center" || key.endsWith(" - center")) return { kind: "group", groupName: "Center" }
  if (key.includes("annual fundraiser")) {
    return { kind: "fund", category: GENERAL_CATEGORY, fund: CAMPAIGN_FUND }
  }
  if (key.includes("sadaqah")) return { kind: "fund", category: GENERAL_CATEGORY, fund: "Sadaqah" }
  if (key.includes("zakat")) return { kind: "fund", category: "Zakat", fund: "Zakat" }
  if (key.includes("masjid operations")) {
    return { kind: "fund", category: "Operations", fund: "Masjid Operations" }
  }
  if (key.includes("renovation")) return { kind: "fund", category: "Operations", fund: "MAS Renovations" }
  if (key.includes("marouf")) return { kind: "fund", category: GENERAL_CATEGORY, fund: "The Marouf Community" }
  if (key.includes("sustainer")) return { kind: "fund", category: GENERAL_CATEGORY, fund: "Sustainers Campaign" }
  return { kind: "fund", category: GENERAL_CATEGORY, fund: text || "General Fund" }
}

function frequencyOf(recurringType) {
  const key = normalizeText(recurringType).toLowerCase()
  if (key === "monthly") return "monthly"
  if (key === "weekly") return "weekly"
  if (key === "daily") return "daily"
  if (key === "quarterly") return "quarterly"
  if (key === "yearly" || key === "annually") return "annually"
  return null
}

function advanceDate(dateStr, frequency) {
  const [year, month, day] = dateStr.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  if (frequency === "daily") date.setDate(date.getDate() + 1)
  else if (frequency === "weekly") date.setDate(date.getDate() + 7)
  else if (frequency === "monthly") date.setMonth(date.getMonth() + 1)
  else if (frequency === "quarterly") date.setMonth(date.getMonth() + 3)
  else date.setFullYear(date.getFullYear() + 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function nextAfter(start, frequency, latest) {
  let cursor = start
  let guard = 0
  while (cursor <= latest && guard < 800) {
    cursor = advanceDate(cursor, frequency)
    guard += 1
  }
  return cursor
}

function readRows(filePath) {
  const grid = parseCsv(readFileSync(filePath, "utf8"))
  const header = (grid[0] || []).map((cell) => normalizeText(cell).toLowerCase())
  const expected = [
    "customer name",
    "transaction date",
    "payment / donation reason",
    "amount",
    "customer phone",
    "customer email",
    "recurring type",
    "payment remarks",
    "transaction id",
  ]
  if (expected.some((label, index) => header[index] !== label)) {
    throw new Error(`Unexpected header: ${header.join(" | ")}`)
  }
  const rows = []
  for (let index = 1; index < grid.length; index += 1) {
    const cells = grid[index]
    if (!cells || cells.every((cell) => !normalizeText(cell))) continue
    const name = normalizeText(cells[0])
    const email = normalizeEmail(cells[5])
    let displayName = name || (email ? email.split("@")[0].replace(/[._-]+/g, " ") : "")
    if (email === "ghabofarag@hotmail.com") displayName = "Ghada Abofarag"
    const amount = money(cells[3])
    const paymentDate = parseDate(cells[1])
    const reason = normalizeText(cells[2])
    if (!displayName || amount < 0.01 || !paymentDate) continue
    const txnId = normalizeText(cells[8])
    const hash = createHash("sha256")
      .update([txnId || `row:${index}`, displayName, paymentDate, amount.toFixed(2), reason].join("|"))
      .digest("hex")
      .slice(0, 12)
    rows.push({
      excelRow: index + 1,
      name: displayName,
      email: email || null,
      phone: normalizePhone(cells[4]) || null,
      amount,
      paymentDate,
      reason,
      mapping: mapReason(reason),
      recurringType: normalizeText(cells[6]) || "ONE_TIME",
      frequency: frequencyOf(cells[6]),
      remarks: normalizeText(cells[7]) || null,
      txnId: txnId || null,
      hash,
    })
  }
  rows.sort((left, right) => left.paymentDate.localeCompare(right.paymentDate) || left.excelRow - right.excelRow)
  return rows
}

function txnIdsFromNotes(notes) {
  return [...String(notes || "").matchAll(/Txn:\s*(\S+)/g)].map((match) => match[1])
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

async function fetchAll(table, filters = [], select = "*") {
  const rows = []
  let from = 0
  while (true) {
    let query = sb.from(table).select(select).range(from, from + 999)
    for (const filter of filters) query = query.eq(filter.col, filter.val)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

function personMatches(row, person) {
  if (row.email && person.email && row.email === person.email) return "email"
  if (row.phone && person.phone && row.phone === person.phone) return "phone"
  if (person.name && namesMatch(row.name, person.name)) return "name"
  return null
}

function pledgePersonMatches(row, pledge) {
  if (row.email && pledge.email && row.email === pledge.email) return "email"
  if (pledge.name && namesMatch(row.name, pledge.name)) return "name"
  return null
}

function choosePledge(candidates, row) {
  if (candidates.length === 1) return { pledge: candidates[0], how: "only" }
  const withTxn = row.txnId ? candidates.filter((pledge) => pledge.txnIds.includes(row.txnId)) : []
  const pool = withTxn.length ? withTxn : candidates
  if (pool.length === 1) return { pledge: pool[0], how: "txn" }
  if (row.mapping.kind === "group") {
    const grouped = pool.filter(
      (pledge) => normalizeName(pledge.groupName) === normalizeName(row.mapping.groupName)
    )
    if (grouped.length === 1) return { pledge: grouped[0], how: "group" }
  } else {
    const ungrouped = pool.filter((pledge) => !pledge.groupName)
    if (ungrouped.length === 1) return { pledge: ungrouped[0], how: "ungrouped" }
  }
  const open = pool.filter((pledge) => pledge.remaining > 0.009)
  const usable = (open.length ? open : pool).slice().sort((left, right) => {
    const leftGap = Math.abs(left.remaining - row.amount)
    const rightGap = Math.abs(right.remaining - row.amount)
    if (leftGap !== rightGap) return leftGap - rightGap
    return right.amount - left.amount
  })
  return { pledge: usable[0], how: "closest", ambiguous: true, options: usable.map((pledge) => pledge.nameAmount) }
}

async function main() {
  const rows = readRows(args.file)
  const [campaign, pledgesRaw, groups, plansRaw, categories, funds, contacts, donors, existingPayments] =
    await Promise.all([
      sb.from("campaigns").select("id, name, organization_id").eq("id", args.campaignId).single(),
      fetchAll("pledges", [{ col: "campaign_id", val: args.campaignId }]),
      fetchAll("campaign_groups", [{ col: "campaign_id", val: args.campaignId }]),
      fetchAll("recurring_donation_plans", [{ col: "campaign_id", val: args.campaignId }]),
      fetchAll("donation_categories", [{ col: "organization_id", val: args.orgId }]),
      fetchAll("donation_subcategories", [{ col: "organization_id", val: args.orgId }]),
      fetchAll("contacts", [{ col: "organization_id", val: args.orgId }], "id, full_name, email, phone, contact_type"),
      fetchAll("donors", [{ col: "organization_id", val: args.orgId }], "id, contact_id, full_name, email, phone, donor_type"),
      fetchAll(
        "payments",
        [{ col: "organization_id", val: args.orgId }],
        "id, external_id, memo, pledge_id, recurring_donation_plan_id, amount"
      ),
    ])
  if (campaign.error || !campaign.data) throw new Error(campaign.error?.message || "Campaign not found")
  if (campaign.data.organization_id !== args.orgId) {
    throw new Error("Campaign is not in the MAS DFW organization")
  }

  const contactById = new Map(contacts.map((contact) => [contact.id, contact]))
  const donorById = new Map(donors.map((donor) => [donor.id, donor]))
  const donorByContactId = new Map(donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor]))
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const importedHashes = new Set()
  const importedTxnIds = new Set()
  for (const payment of existingPayments) {
    if (!String(payment.memo || "").includes(IMPORT_TAG)) continue
    const hash = String(payment.memo).split("|").map((part) => part.trim())[1]
    if (hash) importedHashes.add(hash)
    if (payment.external_id) importedTxnIds.add(payment.external_id)
  }

  const pledges = pledgesRaw
    .filter((pledge) => String(pledge.status || "").toLowerCase() !== "cancelled")
    .map((pledge) => {
      const donor = donorById.get(pledge.donor_id)
      const contact = donor?.contact_id ? contactById.get(donor.contact_id) : null
      const group = pledge.campaign_group_id ? groupById.get(pledge.campaign_group_id) : null
      const name = contact?.full_name || donor?.full_name || "Unknown"
      return {
        id: pledge.id,
        donorId: pledge.donor_id,
        contactId: donor?.contact_id || null,
        name,
        email: normalizeEmail(contact?.email || donor?.email),
        phone: normalizePhone(contact?.phone || donor?.phone),
        groupName: group?.name || null,
        groupId: group?.id || null,
        groupContactId: group?.organizational_group_id || null,
        amount: money(pledge.amount_pledged),
        remaining: money(pledge.amount_pledged),
        txnIds: txnIdsFromNotes(pledge.notes),
        nameAmount: `${name} $${money(pledge.amount_pledged)}`,
      }
    })

  const plans = plansRaw
    .filter((plan) => String(plan.status || "").toLowerCase() !== "cancelled")
    .map((plan) => {
      const contact = plan.contact_id ? contactById.get(plan.contact_id) : null
      const donor = plan.donor_id ? donorById.get(plan.donor_id) : null
      return {
        id: plan.id,
        donorId: plan.donor_id,
        contactId: plan.contact_id,
        name: contact?.full_name || donor?.full_name || "",
        email: normalizeEmail(contact?.email || donor?.email),
        phone: normalizePhone(contact?.phone || donor?.phone),
        amount: money(plan.amount),
        frequency: plan.frequency,
        totalPayments: plan.total_payments,
        start: String(plan.start_date || "").slice(0, 10),
        end: plan.end_date ? String(plan.end_date).slice(0, 10) : null,
        next: plan.next_payment_date ? String(plan.next_payment_date).slice(0, 10) : null,
        paymentsMade: 0,
        latestPayment: null,
        renameTo: null,
      }
    })

  const contactsByEmail = new Map()
  const contactsByPhone = new Map()
  const contactsByName = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() === "group") continue
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = canonicalName(contact.full_name)
    if (email && !contactsByEmail.has(email)) contactsByEmail.set(email, contact)
    if (phone && !contactsByPhone.has(phone)) contactsByPhone.set(phone, contact)
    if (nameKey && !contactsByName.has(nameKey)) contactsByName.set(nameKey, contact)
  }
  const groupContactsByName = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() !== "group") continue
    groupContactsByName.set(normalizeName(contact.full_name), contact)
  }
  const campaignGroupByName = new Map(groups.map((group) => [normalizeName(group.name), group]))
  const categoryByName = new Map(categories.map((category) => [normalizeName(category.name), category]))
  const fundByName = new Map(funds.map((fund) => [normalizeName(fund.name), fund]))

  const report = {
    tag: IMPORT_TAG,
    campaign: campaign.data.name,
    fileRows: rows.length,
    oneTime: 0,
    oneTimeAmount: 0,
    pledgePayments: 0,
    pledgeAmount: 0,
    planPayments: 0,
    planAmount: 0,
    skippedOlder: 0,
    skippedOlderAmount: 0,
    alreadyImported: 0,
    contactsCreated: 0,
    contactsMatched: 0,
    donorsCreated: 0,
    groupsCreated: 0,
    fundsCreated: 0,
    categoriesCreated: 0,
    paymentsCreated: 0,
    pledgesFulfilled: [],
    ambiguousPledges: [],
    renames: [],
    pledgeApplications: [],
    planApplications: [],
    skipped: [],
    reasonTotals: {},
    errors: [],
  }

  function addReason(row, bucket) {
    const current = report.reasonTotals[row.reason] || { n: 0, amount: 0, buckets: {} }
    current.n += 1
    current.amount = roundMoney(current.amount + row.amount)
    current.buckets[bucket] = (current.buckets[bucket] || 0) + 1
    report.reasonTotals[row.reason] = current
  }

  function findOpenPledges(row) {
    if (row.txnId) {
      const byTxn = pledges.filter((pledge) => pledge.txnIds.includes(row.txnId) && pledge.remaining > 0.009)
      if (byTxn.length) return byTxn
    }
    const matched = []
    for (const pledge of pledges) {
      if (pledge.remaining <= 0.009) continue
      if (!pledgePersonMatches(row, pledge)) continue
      if (!matched.some((item) => item.id === pledge.id)) matched.push(pledge)
    }
    return matched
  }

  function findPlan(row) {
    if (!row.frequency) return null
    const matches = plans.filter((plan) => {
      if (plan.frequency !== row.frequency) return false
      if (Math.abs(plan.amount - row.amount) > 0.009) return false
      return Boolean(personMatches(row, plan))
    })
    return matches.length === 1 ? matches[0] : null
  }

  function rememberContact(contact) {
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const nameKey = canonicalName(contact.full_name)
    if (email) contactsByEmail.set(email, contact)
    if (phone) contactsByPhone.set(phone, contact)
    if (nameKey) contactsByName.set(nameKey, contact)
    contactById.set(contact.id, contact)
  }

  async function ensureContact(row) {
    const existing =
      (row.email && contactsByEmail.get(row.email)) ||
      (row.phone && contactsByPhone.get(row.phone)) ||
      contactsByName.get(canonicalName(row.name)) ||
      contacts.find(
        (contact) =>
          String(contact.contact_type || "").toLowerCase() !== "group" && namesMatch(contact.full_name, row.name)
      ) ||
      null
    if (existing) {
      report.contactsMatched += 1
      return existing
    }
    const contactType = isOrganizationName(row.name) ? "organization" : "individual"
    if (!args.execute) {
      report.contactsCreated += 1
      const placeholder = {
        id: `dry-run:contact:${row.hash}`,
        full_name: row.name,
        email: row.email,
        phone: row.phone,
        contact_type: contactType,
      }
      rememberContact(placeholder)
      contacts.push(placeholder)
      return placeholder
    }
    const { data: contactId, error: rpcError } = await sb.rpc("find_or_create_contact_for_org", {
      p_organization_id: args.orgId,
      p_full_name: row.name,
      p_email: row.email,
      p_phone: row.phone,
      p_contact_type: contactType,
    })
    if (rpcError || !contactId) throw new Error(rpcError?.message || `contact ${row.name}`)
    const { data, error } = await sb
      .from("contacts")
      .select("id, full_name, email, phone, contact_type")
      .eq("id", contactId)
      .single()
    if (error) throw new Error(error.message)
    rememberContact(data)
    report.contactsCreated += 1
    return data
  }

  async function ensureDonor(contact) {
    if (donorByContactId.has(contact.id)) return donorByContactId.get(contact.id)
    const donorType = contact.contact_type === "organization" ? "organization" : "individual"
    if (!args.execute) {
      report.donorsCreated += 1
      const placeholder = { id: `dry-run:donor:${contact.id}`, contact_id: contact.id, full_name: contact.full_name }
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
        donor_type: donorType,
        status: "active",
      })
      .select("id, contact_id, full_name")
      .single()
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await sb
          .from("donors")
          .select("id, contact_id, full_name")
          .eq("organization_id", args.orgId)
          .eq("contact_id", contact.id)
          .maybeSingle()
        if (existing) {
          donorByContactId.set(contact.id, existing)
          return existing
        }
      }
      throw new Error(`donor (${contact.full_name}): ${error.message}`)
    }
    donorByContactId.set(contact.id, data)
    report.donorsCreated += 1
    return data
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
    if (error) throw new Error(`category (${name}): ${error.message}`)
    categoryByName.set(key, data)
    report.categoriesCreated += 1
    return data
  }

  async function ensureFund(name, categoryId) {
    const key = normalizeName(name)
    if (fundByName.has(key)) return fundByName.get(key)
    if (!args.execute || String(categoryId).startsWith("dry-run:")) {
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
    if (error) throw new Error(`fund (${name}): ${error.message}`)
    fundByName.set(key, data)
    report.fundsCreated += 1
    return data
  }

  async function ensureGroup(groupName) {
    const key = normalizeName(groupName)
    let groupContact = groupContactsByName.get(key)
    if (!groupContact) {
      if (!args.execute) {
        report.groupsCreated += 1
        groupContact = { id: `dry-run:group:${key}`, full_name: groupName, contact_type: "group" }
      } else {
        const { data, error } = await sb
          .from("contacts")
          .insert({
            organization_id: args.orgId,
            full_name: groupName,
            contact_type: "group",
            status: "active",
            giving_group_kind: "group_donation",
          })
          .select("id, full_name, contact_type")
          .single()
        if (error) throw new Error(`group (${groupName}): ${error.message}`)
        groupContact = data
        report.groupsCreated += 1
      }
      groupContactsByName.set(key, groupContact)
    }
    let campaignGroup = campaignGroupByName.get(key)
    if (!campaignGroup) {
      if (!args.execute || String(groupContact.id).startsWith("dry-run:")) {
        campaignGroup = {
          id: `dry-run:campaign-group:${key}`,
          name: groupName,
          organizational_group_id: groupContact.id,
        }
      } else {
        const { data, error } = await sb
          .from("campaign_groups")
          .insert({
            organization_id: args.orgId,
            campaign_id: args.campaignId,
            name: groupName,
            organizational_group_id: groupContact.id,
            lead_contact_id: null,
            goal_amount: null,
            description: "September 2026 transaction import",
            public_token: randomUUID().replace(/-/g, ""),
            status: "active",
            public_progress_enabled: true,
            link_active: true,
          })
          .select("id, name, organizational_group_id")
          .single()
        if (error) throw new Error(`campaign group (${groupName}): ${error.message}`)
        campaignGroup = data
      }
      campaignGroupByName.set(key, campaignGroup)
    }
    return campaignGroup
  }

  const paymentPayloads = []
  const affectedContactIds = new Set()
  const pledgeIdsToRefresh = new Set()
  const planCharges = new Map()

  for (const row of rows) {
    try {
      if (importedHashes.has(row.hash) || (row.txnId && importedTxnIds.has(row.txnId))) {
        report.alreadyImported += 1
        continue
      }
      const openPledges = findOpenPledges(row)
      let bucket = "one_time"
      let pledge = null
      let plan = null
      let how = null
      if (openPledges.length) {
        const choice = choosePledge(openPledges, row)
        pledge = choice.pledge
        how = choice.how
        bucket = "pledge"
        if (choice.ambiguous) {
          report.ambiguousPledges.push({
            name: row.name,
            amount: row.amount,
            reason: row.reason,
            chosen: pledge.nameAmount,
            how,
            options: choice.options,
          })
        }
      } else if (row.frequency) {
        plan = findPlan(row)
        if (plan) bucket = "plan"
        else {
          bucket = "skipped"
          report.skippedOlder += 1
          report.skippedOlderAmount += row.amount
          report.skipped.push({
            name: row.name,
            amount: row.amount,
            date: row.paymentDate,
            reason: row.reason,
            frequency: row.frequency,
          })
          addReason(row, "skipped")
          continue
        }
      }

      const categoryName = row.mapping.kind === "group" ? GENERAL_CATEGORY : row.mapping.category
      const fundName = row.mapping.kind === "group" ? CAMPAIGN_FUND : row.mapping.fund
      const category = await ensureCategory(categoryName)
      const fund = await ensureFund(fundName, category.id)
      let campaignGroup = null
      if (row.mapping.kind === "group") campaignGroup = await ensureGroup(row.mapping.groupName)
      else if (pledge?.groupId) {
        campaignGroup = {
          id: pledge.groupId,
          organizational_group_id: pledge.groupContactId,
          name: pledge.groupName,
        }
      }

      let contact
      let donor
      if (pledge) {
        contact = { id: pledge.contactId, full_name: pledge.name }
        donor = { id: pledge.donorId, contact_id: pledge.contactId }
        pledge.remaining = roundMoney(pledge.remaining - row.amount)
        report.pledgePayments += 1
        report.pledgeAmount += row.amount
        report.pledgeApplications.push({
          name: row.name,
          amount: row.amount,
          date: row.paymentDate,
          reason: row.reason,
          pledge: pledge.nameAmount,
          how,
          remainingAfter: pledge.remaining,
        })
        if (pledge.remaining <= 0.009 && !report.pledgesFulfilled.includes(pledge.nameAmount)) {
          report.pledgesFulfilled.push(pledge.nameAmount)
        }
        pledgeIdsToRefresh.add(pledge.id)
      } else if (plan) {
        contact = { id: plan.contactId, full_name: plan.name }
        donor = { id: plan.donorId, contact_id: plan.contactId }
        plan.paymentsMade += 1
        if (!plan.latestPayment || row.paymentDate > plan.latestPayment) plan.latestPayment = row.paymentDate
        if (
          canonicalName(row.name) === canonicalName(plan.name) &&
          normalizeName(row.name) !== normalizeName(plan.name)
        ) {
          plan.renameTo = row.name
          if (!report.renames.some((item) => item.to === row.name)) {
            report.renames.push({ from: plan.name, to: row.name })
          }
        }
        report.planPayments += 1
        report.planAmount += row.amount
        const list = planCharges.get(plan.id) || []
        list.push(row.paymentDate)
        planCharges.set(plan.id, list)
        report.planApplications.push({
          name: row.name,
          planName: plan.name,
          amount: row.amount,
          date: row.paymentDate,
          reason: row.reason,
        })
      } else {
        contact = await ensureContact(row)
        donor = await ensureDonor(contact)
        report.oneTime += 1
        report.oneTimeAmount += row.amount
      }

      const realContactId = contact?.id && !String(contact.id).startsWith("dry-run:") ? contact.id : null
      const realDonorId = donor?.id && !String(donor.id).startsWith("dry-run:") ? donor.id : null
      if (realContactId) affectedContactIds.add(realContactId)
      const groupId = campaignGroup && !String(campaignGroup.id).startsWith("dry-run:") ? campaignGroup.id : null
      const groupContactId =
        campaignGroup?.organizational_group_id &&
        !String(campaignGroup.organizational_group_id).startsWith("dry-run:")
          ? campaignGroup.organizational_group_id
          : null
      const paidBy = pledge && !namesMatch(row.name, pledge.name) ? `Paid by ${row.name}` : null
      paymentPayloads.push({
        organization_id: args.orgId,
        donor_id: realDonorId,
        contact_id: realContactId,
        amount: row.amount,
        payment_date: `${row.paymentDate}T12:00:00.000Z`,
        source: "stripe",
        source_type: "import",
        status: "unallocated",
        sender_name: row.name,
        category_id: String(category.id).startsWith("dry-run:") ? null : category.id,
        subcategory_id: String(fund.id).startsWith("dry-run:") ? null : fund.id,
        campaign_id: args.campaignId,
        campaign_group_id: groupId,
        attributed_group_contact_id: groupContactId,
        pledge_id: pledge && !String(pledge.id).startsWith("dry-run:") ? pledge.id : null,
        recurring_donation_plan_id: plan ? plan.id : null,
        external_id: row.txnId,
        stripe_charge_id: row.txnId && row.txnId.startsWith("ch_") ? row.txnId : null,
        import_email: row.email,
        import_phone: row.phone,
        memo: [IMPORT_TAG, row.hash, row.reason, row.recurringType, row.txnId, row.remarks, paidBy]
          .filter(Boolean)
          .join(" | "),
        is_verified: true,
      })
      addReason(row, bucket)
      importedHashes.add(row.hash)
      if (row.txnId) importedTxnIds.add(row.txnId)
    } catch (error) {
      report.errors.push({ excelRow: row.excelRow, name: row.name, error: error.message })
    }
  }

  if (args.execute) {
    for (let index = 0; index < paymentPayloads.length; index += PAYMENT_BATCH_SIZE) {
      const batch = paymentPayloads.slice(index, index + PAYMENT_BATCH_SIZE)
      const { error } = await sb.from("payments").insert(batch)
      if (error) report.errors.push({ batch: `${index + 1}-${index + batch.length}`, error: error.message })
      else report.paymentsCreated += batch.length
    }
    for (const pledgeId of pledgeIdsToRefresh) {
      const { error } = await sb.rpc("refresh_pledge_status", { p_pledge_id: pledgeId })
      if (error) report.errors.push({ pledgeId, error: error.message })
    }
    for (const plan of plans) {
      if (!plan.paymentsMade) continue
      const computedNext = plan.start ? nextAfter(plan.start, plan.frequency, plan.latestPayment) : null
      const next = computedNext && plan.next && computedNext < plan.next ? plan.next : computedNext || plan.next
      const finishedByCount = plan.totalPayments && plan.paymentsMade >= Number(plan.totalPayments)
      const finishedByEnd = Boolean(plan.end && next && next > plan.end)
      const patch = {
        payments_made: plan.paymentsMade,
        status: finishedByCount || finishedByEnd ? "completed" : "active",
      }
      if (next) patch.next_payment_date = finishedByEnd ? plan.end : next
      const { error } = await sb.from("recurring_donation_plans").update(patch).eq("id", plan.id)
      if (error) report.errors.push({ planId: plan.id, error: error.message })
      if (plan.renameTo && plan.contactId) {
        const { error: contactError } = await sb
          .from("contacts")
          .update({ full_name: plan.renameTo })
          .eq("id", plan.contactId)
        if (contactError) report.errors.push({ contactId: plan.contactId, error: contactError.message })
        if (plan.donorId) {
          const { error: donorError } = await sb
            .from("donors")
            .update({ full_name: plan.renameTo })
            .eq("id", plan.donorId)
          if (donorError) report.errors.push({ donorId: plan.donorId, error: donorError.message })
        }
      }
    }
    for (const contactId of affectedContactIds) {
      const { error } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: args.orgId,
        p_contact_id: contactId,
      })
      if (error) report.errors.push({ contactId, error: error.message })
    }
  } else {
    report.paymentsCreated = paymentPayloads.length
  }

  report.oneTimeAmount = roundMoney(report.oneTimeAmount)
  report.pledgeAmount = roundMoney(report.pledgeAmount)
  report.planAmount = roundMoney(report.planAmount)
  report.skippedOlderAmount = roundMoney(report.skippedOlderAmount)
  report.planSummaries = plans
    .filter((plan) => plan.paymentsMade)
    .map((plan) => ({
      name: plan.name,
      amount: plan.amount,
      frequency: plan.frequency,
      paymentsMade: plan.paymentsMade,
      latest: plan.latestPayment,
      status:
        (plan.totalPayments && plan.paymentsMade >= Number(plan.totalPayments)) ||
        (plan.end && plan.start && nextAfter(plan.start, plan.frequency, plan.latestPayment) > plan.end)
          ? "completed"
          : "active",
    }))

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(
    reportsDir,
    args.execute ? "september-2026-transactions-dfw-execute.json" : "september-2026-transactions-dfw-dry-run.json"
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  const summary = {
    fileRows: report.fileRows,
    paymentsCreated: report.paymentsCreated,
    oneTime: report.oneTime,
    oneTimeAmount: report.oneTimeAmount,
    pledgePayments: report.pledgePayments,
    pledgeAmount: report.pledgeAmount,
    planPayments: report.planPayments,
    planAmount: report.planAmount,
    skippedOlder: report.skippedOlder,
    skippedOlderAmount: report.skippedOlderAmount,
    pledgesFulfilled: report.pledgesFulfilled,
    ambiguousPledges: report.ambiguousPledges,
    renames: report.renames,
    groupsCreated: report.groupsCreated,
    categoriesCreated: report.categoriesCreated,
    fundsCreated: report.fundsCreated,
    contactsCreated: report.contactsCreated,
    planSummaries: report.planSummaries,
    pledgeApplications: report.pledgeApplications,
    errors: report.errors,
  }
  console.log(JSON.stringify(summary, null, 2))
  console.log(`\nReport written to ${reportPath}`)
  if (!args.execute) console.log("\nDry run only. Re-run with --execute to import.")
  if (report.errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
