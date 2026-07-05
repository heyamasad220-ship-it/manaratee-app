import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CSV_PATH = "C:/Users/danan/Downloads/RecurringDonations07032026.csv"
const ORG = "e057e00a-e4e3-4adf-9af5-f465db1894be"

const CATEGORY_FUND_MAP = new Map([
  ["sadaqah donation", { category: "General Donation", fund: "Sadaqah/Donation" }],
  ["masjid operations", { category: "Operations", fund: "Masjid Operations" }],
  ["zakat", { category: "Zakat", fund: null }],
  ["family emergency takaful fund", { category: "Family Emergency Takaful Fund", fund: null }],
])

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

function normName(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normEmail(v) {
  const t = String(v ?? "").trim().toLowerCase()
  return t.includes("@") ? t : ""
}

function parseMoney(v) {
  const n = Number(String(v ?? "").replace(/[$,]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function parseDate(v) {
  if (!v) return null
  const d = new Date(String(v).trim())
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const FREQ_MAP = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  ANNUALLY: "annually",
  YEARLY: "annually",
}

function mapCategoryFund(raw) {
  const key = normName(raw)
  if (CATEGORY_FUND_MAP.has(key)) return CATEGORY_FUND_MAP.get(key)
  return { category: raw?.trim() || "General Donation", fund: null }
}

function mapStatus(raw) {
  const s = String(raw || "").trim().toLowerCase()
  if (s === "active") return "active"
  if (s === "cancelled" || s === "canceled") return "cancelled"
  if (s === "completed") return "completed"
  if (s === "paused") return "paused"
  return "completed"
}

loadEnv()
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const csv = readFileSync(CSV_PATH, "utf8")
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
const rows = parsed.data

console.log("=== CSV STRUCTURE ===")
console.log("Columns:", Object.keys(rows[0] || {}))
console.log("Total rows:", rows.length)

const statuses = {}
const frequencies = {}
const categoryFunds = new Map()
let noName = 0
let unknownFreq = 0
let unknownCategory = 0

for (const row of rows) {
  statuses[row.Status] = (statuses[row.Status] || 0) + 1
  const freqKey = String(row.Frequency || "").trim().toUpperCase()
  frequencies[freqKey] = (frequencies[freqKey] || 0) + 1
  if (!String(row["Customer Name"] || "").trim()) noName += 1
  if (!FREQ_MAP[freqKey]) unknownFreq += 1
  const cf = mapCategoryFund(row["Category/Fund"])
  const cfKey = `${cf.category}|${cf.fund || ""}`
  categoryFunds.set(cfKey, (categoryFunds.get(cfKey) || 0) + 1)
  if (!CATEGORY_FUND_MAP.has(normName(row["Category/Fund"]))) unknownCategory += 1
}

console.log("\nStatuses:", statuses)
console.log("Frequencies:", frequencies)
console.log("No name:", noName, "Unknown freq:", unknownFreq)
console.log("Unmapped Category/Fund rows:", unknownCategory)
console.log("Category/Fund breakdown:")
for (const [key, count] of [...categoryFunds.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key}: ${count}`)
}

async function fetchAll(table, filters = []) {
  const out = []
  let from = 0
  while (true) {
    let query = sb.from(table).select("*").range(from, from + 999)
    for (const f of filters) {
      if (f.op === "eq") query = query.eq(f.col, f.val)
    }
    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

const plans = await fetchAll("recurring_donation_plans", [
  { op: "eq", col: "organization_id", val: ORG },
])
const donors = await fetchAll("donors", [{ op: "eq", col: "organization_id", val: ORG }])
const contacts = await fetchAll("contacts", [{ op: "eq", col: "organization_id", val: ORG }])
const categories = await fetchAll("donation_categories", [
  { op: "eq", col: "organization_id", val: ORG },
])
const subcategories = await fetchAll("donation_subcategories", [
  { op: "eq", col: "organization_id", val: ORG },
])

const donorByContactId = new Map(
  donors.filter((d) => d.contact_id).map((d) => [d.contact_id, d])
)
const contactByEmail = new Map()
const contactByName = new Map()
for (const c of contacts) {
  const email = normEmail(c.email)
  if (email) contactByEmail.set(email, c)
  const name = normName(c.full_name)
  if (name) contactByName.set(name, c)
}

const categoryByName = new Map(categories.map((c) => [normName(c.name), c]))
const fundByName = new Map(subcategories.map((f) => [normName(f.name), f]))

function findDonor(row) {
  const email = normEmail(row["Customer Email"])
  const name = normName(row["Customer Name"])
  if (email && contactByEmail.has(email)) {
    return donorByContactId.get(contactByEmail.get(email).id)
  }
  if (name && contactByName.has(name)) {
    return donorByContactId.get(contactByName.get(name).id)
  }
  return null
}

function planMatchKey(donorId, amount, frequency, categoryId, subcategoryId) {
  return `${donorId}|${Number(amount).toFixed(2)}|${frequency}|${categoryId || ""}|${subcategoryId || ""}`
}

const dbPlanKeys = new Set(
  plans.map((p) => planMatchKey(p.donor_id, p.amount, p.frequency, p.category_id, p.subcategory_id))
)

let matched = 0
let missingDonor = 0
let notInDb = 0
let activeInCsv = 0
let activeMissing = 0
const notInDbSamples = []
const activeMissingSamples = []
const unmappedCategorySamples = []

for (const row of rows) {
  const freqKey = String(row.Frequency || "").trim().toUpperCase()
  const freq = FREQ_MAP[freqKey]
  if (!freq) continue

  const amount = parseMoney(row.Amount)
  if (amount <= 0) continue

  const donor = findDonor(row)
  if (!donor) {
    missingDonor += 1
    continue
  }

  const mapped = mapCategoryFund(row["Category/Fund"])
  const category = categoryByName.get(normName(mapped.category))
  const fund = mapped.fund ? fundByName.get(normName(mapped.fund)) : null

  if (!category && notInDbSamples.length < 3) {
    unmappedCategorySamples.push(row["Category/Fund"])
  }

  const key = planMatchKey(donor.id, amount, freq, category?.id, fund?.id)
  const csvStatus = mapStatus(row.Status)
  if (csvStatus === "active") activeInCsv += 1

  if (dbPlanKeys.has(key)) {
    matched += 1
  } else {
    notInDb += 1
    if (csvStatus === "active") activeMissing += 1
    if (notInDbSamples.length < 20) {
      notInDbSamples.push({
        name: row["Customer Name"],
        email: row["Customer Email"],
        amount,
        frequency: freq,
        categoryFund: row["Category/Fund"],
        status: row.Status,
        start: row["Plan Start Date"],
        end: row["Plan End Date"] || null,
        paymentsMade: row["Payments Made"],
      })
    }
    if (csvStatus === "active" && activeMissingSamples.length < 15) {
      activeMissingSamples.push({
        name: row["Customer Name"],
        amount,
        frequency: freq,
        categoryFund: row["Category/Fund"],
        start: row["Plan Start Date"],
        paymentsMade: row["Payments Made"],
      })
    }
  }
}

const dbOnlyEstimate = plans.length - matched

console.log("\n=== DB STATE ===")
console.log("Existing recurring plans:", plans.length)
const dbByFreq = {}
const dbByStatus = {}
for (const p of plans) {
  dbByFreq[p.frequency] = (dbByFreq[p.frequency] || 0) + 1
  dbByStatus[p.status] = (dbByStatus[p.status] || 0) + 1
}
console.log("DB by frequency:", dbByFreq)
console.log("DB by status:", dbByStatus)

console.log("\n=== COMPARISON (donor + amount + frequency + category + fund) ===")
console.log("CSV plan rows:", rows.length)
console.log("Matched existing DB plan:", matched)
console.log("CSV row, donor not found:", missingDonor)
console.log("NOT in DB (candidate import):", notInDb)
console.log("  of which ACTIVE:", activeMissing)
console.log("DB plans not matched by any CSV row (approx):", Math.max(0, dbOnlyEstimate))

console.log("\nACTIVE plans in CSV missing from DB:")
console.log(JSON.stringify(activeMissingSamples, null, 2))
console.log("\nSample rows NOT in DB:")
console.log(JSON.stringify(notInDbSamples.slice(0, 12), null, 2))

// Looser match: donor+amount+frequency only
const dbLoose = new Set(plans.map((p) => `${p.donor_id}|${Number(p.amount).toFixed(2)}|${p.frequency}`))
let looseMatched = 0
let looseMissing = 0
for (const row of rows) {
  const freq = FREQ_MAP[String(row.Frequency || "").trim().toUpperCase()]
  if (!freq) continue
  const donor = findDonor(row)
  if (!donor) continue
  const key = `${donor.id}|${parseMoney(row.Amount).toFixed(2)}|${freq}`
  if (dbLoose.has(key)) looseMatched++
  else looseMissing++
}
console.log("\n=== LOOSE MATCH (donor+amount+frequency only) ===")
console.log("Matched:", looseMatched, "Not matched:", looseMissing)
