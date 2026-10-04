/**
 * Square subscription report → MAS DFW Annual Fundraiser - September 2026.
 *
 * A row with a matching campaign pledge is skipped. Pledge schedules are not
 * changed. Everyone else becomes an active recurring donation on this campaign.
 * No payments are recorded.
 *
 *   node scripts/import-september-2026-subscriptions.mjs
 *   node scripts/import-september-2026-subscriptions.mjs --execute
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "54f5db10-02fe-433a-b91a-f90c16882a97"
const DEFAULT_CAMPAIGN_ID = "fa15246a-e80d-4d65-9bf4-a5af4051b821"
const DEFAULT_FILE = "C:/Users/danan/Downloads/PAYMENT_SUBSCRIPTION_REPORT_2026-10-03.csv"
const IMPORT_TAG = "SEP2026_SUBSCRIPTIONS_DFW_V1"
const GENERAL_CATEGORY_NAME = "General Donation"
const TODAY = "2026-10-03"

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
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(dr|mr|mrs|ms|sheikh)\s+/, "")
}

function nameTokens(value) {
  return normalizeName(value).split(" ").filter(Boolean)
}

function tokensMatch(left, right) {
  return left === right || left === `al${right}` || right === `al${left}`
}

function namesMatch(leftName, rightName) {
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
  const [month, day, year] = text.split("/")
  if (!year || !month || !day) return null
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

function parseCount(value) {
  const count = Number(normalizeText(value))
  return Number.isInteger(count) && count > 0 ? count : null
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

function nextOnOrAfter(start, frequency, today) {
  let cursor = start
  let guard = 0
  while (cursor < today && guard < 800) {
    cursor = advanceDate(cursor, frequency)
    guard += 1
  }
  return cursor
}

function isOrganizationName(name) {
  return /\b(llc|inc\.?|foundation|pharmacy|labs|market|mortgage|memorial|scouts|forum|society|association)\b/i.test(
    name
  )
}

function readRows(filePath) {
  const grid = parseCsv(readFileSync(filePath, "utf8"))
  const header = (grid[0] || []).map((cell) => normalizeText(cell).toLowerCase())
  const expected = [
    "customer name",
    "payment / donation reason",
    "amount",
    "customer email",
    "customer phone",
    "recurring type",
    "subscription start date",
    "subscription end date",
    "remarks",
    "total payments",
  ]
  if (expected.some((label, index) => header[index] !== label)) {
    throw new Error(`Unexpected header: ${header.join(" | ")}`)
  }
  const rows = []
  for (let index = 1; index < grid.length; index += 1) {
    const cells = grid[index]
    if (!cells || !normalizeText(cells[0])) continue
    const frequency = normalizeText(cells[5]).toLowerCase()
    const row = {
      excelRow: index + 1,
      name: normalizeText(cells[0]),
      reason: normalizeText(cells[1]) || null,
      amount: money(cells[2]),
      email: normalizeEmail(cells[3]) || null,
      phone: normalizePhone(cells[4]) || null,
      frequency,
      start: parseDate(cells[6]),
      end: parseDate(cells[7]),
      remarks: normalizeText(cells[8]).replace(/\s+/g, " ") || null,
      totalPayments: parseCount(cells[9]),
    }
    if (row.amount < 0.01 || !row.start) continue
    if (!["daily", "weekly", "monthly", "quarterly", "annually"].includes(row.frequency)) {
      throw new Error(`Unsupported frequency on row ${row.excelRow}: ${row.frequency}`)
    }
    row.hash = createHash("sha256")
      .update([row.name, row.amount.toFixed(2), row.frequency, row.start].join("|"))
      .digest("hex")
      .slice(0, 12)
    row.organization = isOrganizationName(row.name)
    rows.push(row)
  }
  return rows
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

async function main() {
  const rows = readRows(args.file)
  const report = {
    execute: args.execute,
    file: args.file,
    campaignId: args.campaignId,
    campaignName: null,
    rows: rows.length,
    skippedPledge: [],
    plansCreated: 0,
    plansSkipped: 0,
    contactsCreated: 0,
    donorsCreated: 0,
    monthlyAmount: 0,
    dailyAmount: 0,
    errors: [],
  }

  const { data: campaign, error: campaignError } = await sb
    .from("campaigns")
    .select("id, name, organization_id")
    .eq("id", args.campaignId)
    .eq("organization_id", args.orgId)
    .maybeSingle()
  if (campaignError) throw new Error(campaignError.message)
  if (!campaign) throw new Error("Campaign not found for MAS DFW")
  report.campaignName = campaign.name

  const [pledges, donors, contacts, categories, funds, existingPlans] = await Promise.all([
    fetchAll("pledges", [
      { col: "organization_id", val: args.orgId },
      { col: "campaign_id", val: args.campaignId },
    ]),
    fetchAll("donors", [{ col: "organization_id", val: args.orgId }]),
    fetchAll("contacts", [{ col: "organization_id", val: args.orgId }]),
    fetchAll("donation_categories", [{ col: "organization_id", val: args.orgId }]),
    fetchAll("donation_subcategories", [{ col: "organization_id", val: args.orgId }]),
    fetchAll("recurring_donation_plans", [
      { col: "organization_id", val: args.orgId },
      { col: "campaign_id", val: args.campaignId },
    ]),
  ])

  const donorById = new Map(donors.map((donor) => [donor.id, donor]))
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]))
  const pledgeDonors = pledges.map((pledge) => {
    const donor = donorById.get(pledge.donor_id)
    const contact = donor?.contact_id ? contactById.get(donor.contact_id) : null
    return {
      name: contact?.full_name || donor?.full_name || "",
      email: normalizeEmail(contact?.email || donor?.email),
      phone: normalizePhone(contact?.phone || donor?.phone),
      amount: Number(pledge.amount_pledged),
    }
  })

  function matchingPledge(row) {
    return (
      pledgeDonors.find((pledge) => {
        if (row.email && pledge.email && row.email === pledge.email) return true
        if (row.phone && pledge.phone && row.phone === pledge.phone) return true
        return namesMatch(row.name, pledge.name)
      }) || null
    )
  }

  const importedHashes = new Set()
  for (const plan of existingPlans) {
    const match = String(plan.notes || "").match(new RegExp(`${IMPORT_TAG} \\| ([a-f0-9]{12})`))
    if (match) importedHashes.add(match[1])
  }

  const category = categories.find((item) => normalizeName(item.name) === normalizeName(GENERAL_CATEGORY_NAME))
  const fund = funds.find((item) => normalizeName(item.name) === normalizeName(campaign.name))
  if (!category) throw new Error("General Donation category is missing")
  if (!fund) throw new Error(`Fund ${campaign.name} is missing`)

  const contactsByEmail = new Map()
  const contactsByPhone = new Map()
  const contactsByName = new Map()
  for (const contact of contacts) {
    if (String(contact.contact_type || "").toLowerCase() === "group") continue
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const name = normalizeName(contact.full_name)
    if (email && !contactsByEmail.has(email)) contactsByEmail.set(email, contact)
    if (phone && !contactsByPhone.has(phone)) contactsByPhone.set(phone, contact)
    if (name && !contactsByName.has(name)) contactsByName.set(name, contact)
  }
  const donorByContactId = new Map(
    donors.filter((donor) => donor.contact_id).map((donor) => [donor.contact_id, donor])
  )

  function rememberContact(contact) {
    const email = normalizeEmail(contact.email)
    const phone = normalizePhone(contact.phone)
    const name = normalizeName(contact.full_name)
    if (email) contactsByEmail.set(email, contact)
    if (phone) contactsByPhone.set(phone, contact)
    if (name) contactsByName.set(name, contact)
  }

  async function ensureContact(row) {
    const existing =
      (row.email && contactsByEmail.get(row.email)) ||
      (row.phone && contactsByPhone.get(row.phone)) ||
      contactsByName.get(normalizeName(row.name)) ||
      null
    if (existing) return existing
    const contactType = row.organization ? "organization" : "individual"
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

  const affectedContactIds = new Set()

  for (const row of rows) {
    try {
      const pledge = matchingPledge(row)
      if (pledge) {
        report.skippedPledge.push({
          name: row.name,
          amount: row.amount,
          frequency: row.frequency,
          matchedPledge: pledge.name,
          pledgeAmount: pledge.amount,
        })
        continue
      }
      if (importedHashes.has(row.hash)) {
        report.plansSkipped += 1
        continue
      }
      const contact = await ensureContact(row)
      const donor = await ensureDonor(contact)
      const nextDate = nextOnOrAfter(row.start, row.frequency, TODAY)
      const finished = row.end && nextDate > row.end
      const notes = [IMPORT_TAG, row.hash, row.reason, row.remarks].filter(Boolean).join(" | ")
      if (row.frequency === "daily") report.dailyAmount += row.amount
      else report.monthlyAmount += row.amount
      if (!args.execute) {
        report.plansCreated += 1
        importedHashes.add(row.hash)
        continue
      }
      const { error } = await sb.from("recurring_donation_plans").insert({
        organization_id: args.orgId,
        donor_id: donor.id,
        contact_id: String(contact.id).startsWith("dry-run:") ? null : contact.id,
        campaign_id: args.campaignId,
        category_id: category.id,
        subcategory_id: fund.id,
        amount: row.amount,
        frequency: row.frequency,
        status: finished ? "completed" : "active",
        start_date: row.start,
        end_date: row.end,
        next_payment_date: finished ? row.end : nextDate,
        total_payments: row.totalPayments,
        payments_made: 0,
        external_processor: "square",
        notes,
      })
      if (error) throw new Error(error.message)
      report.plansCreated += 1
      importedHashes.add(row.hash)
      if (!String(contact.id).startsWith("dry-run:")) affectedContactIds.add(contact.id)
    } catch (error) {
      report.errors.push({ excelRow: row.excelRow, name: row.name, error: error.message })
    }
  }

  if (args.execute) {
    for (const contactId of affectedContactIds) {
      const { error } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: args.orgId,
        p_contact_id: contactId,
      })
      if (error) report.errors.push({ contactId, error: error.message })
    }
  }

  report.monthlyAmount = Math.round(report.monthlyAmount * 100) / 100
  report.dailyAmount = Math.round(report.dailyAmount * 100) / 100
  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(
    reportsDir,
    args.execute ? "september-2026-subscriptions-dfw-execute.json" : "september-2026-subscriptions-dfw-dry-run.json"
  )
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport written to ${reportPath}`)
  if (!args.execute) console.log("\nDry run only. Re-run with --execute to import.")
  if (report.errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
