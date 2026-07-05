/**
 * Import Square recurring donation plans from CSV and sync plan metadata.
 *
 * - Maps "Sustainers Campaign" → category Sustainers Club / fund General Donation
 * - Skips Qays Hawwar (manual review)
 * - Inserts missing plans; updates total_payments, payments_made, end_date, status on matches
 *
 * Usage:
 *   node scripts/import-madina-recurring-plans.mjs
 *   node scripts/import-madina-recurring-plans.mjs --execute
 *
 * Requires migration 156_recurring_plan_payment_counts.sql and SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_FILE = "C:/Users/danan/Downloads/RecurringDonations07032026.csv"
const IMPORT_TAG = "MADINA_SQUARE_RECURRING_PLANS_V1"
const STAMP = new Date().toISOString().slice(0, 10)

const CATEGORY_FUND_MAP = new Map([
  ["sadaqah donation", { category: "General Donation", fund: "Sadaqah/Donation" }],
  ["masjid operations", { category: "Operations", fund: "Masjid Operations" }],
  ["zakat", { category: "Zakat", fund: null }],
  ["family emergency takaful fund", { category: "Family Emergency Takaful Fund", fund: null }],
  ["sustainers campaign", { category: "Sustainers Club", fund: "General Donation" }],
])

const FREQ_MAP = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  ANNUALLY: "annually",
  YEARLY: "annually",
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
  const args = { file: DEFAULT_FILE, orgId: DEFAULT_ORG_ID, execute: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--file") args.file = argv[++i]
    else if (argv[i] === "--org") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(v) {
  return String(v ?? "").trim()
}

function normalizeName(v) {
  return normalizeText(v)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeEmail(v) {
  const t = normalizeText(v).toLowerCase()
  return t.includes("@") ? t : ""
}

function parseMoney(v) {
  const n = Number(normalizeText(v).replace(/[$,]/g, ""))
  return Number.isFinite(n) ? n : 0
}

function parseDate(v) {
  if (!v) return null
  const d = new Date(normalizeText(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function parseIntOrNull(v) {
  const n = Number.parseInt(String(v ?? "").trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function mapCategoryFund(raw) {
  const key = normalizeName(raw)
  if (CATEGORY_FUND_MAP.has(key)) return CATEGORY_FUND_MAP.get(key)
  return { category: normalizeText(raw) || "General Donation", fund: null }
}

function mapStatus(raw) {
  const s = normalizeText(raw).toLowerCase()
  if (s === "active") return "active"
  if (s === "cancelled" || s === "canceled") return "cancelled"
  if (s === "completed") return "completed"
  if (s === "paused") return "paused"
  return "completed"
}

const SKIP_DONOR_NAMES = new Set([normalizeName("Qays Hawwar")])

function planLookupKey(donorId, amount, frequency, categoryId, subcategoryId) {
  return `${donorId}|${Number(amount).toFixed(2)}|${frequency}|${categoryId || ""}|${subcategoryId || ""}`
}

function advancePaymentDate(fromDate, frequency, steps) {
  let cursor = fromDate
  for (let i = 0; i < steps; i++) {
    const base = new Date(cursor + "T00:00:00")
    switch (frequency) {
      case "daily":
        base.setDate(base.getDate() + 1)
        break
      case "weekly":
        base.setDate(base.getDate() + 7)
        break
      case "monthly":
        base.setMonth(base.getMonth() + 1)
        break
      case "quarterly":
        base.setMonth(base.getMonth() + 3)
        break
      case "annually":
        base.setFullYear(base.getFullYear() + 1)
        break
      default:
        base.setMonth(base.getMonth() + 1)
    }
    cursor = base.toISOString().slice(0, 10)
  }
  return cursor
}

function computeNextPaymentDate(startDate, frequency, status, paymentsMade) {
  const today = new Date().toISOString().slice(0, 10)
  if (status !== "active" && status !== "paused" && status !== "past_due") {
    return startDate
  }
  const made = paymentsMade ?? 0
  const next = advancePaymentDate(startDate, frequency, Math.max(made, 1))
  return next < today ? today : next
}

loadEnv()
const args = parseArgs(process.argv.slice(2))

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
  const out = []
  let from = 0
  while (true) {
    let query = sb.from(table).select("*").range(from, from + 999)
    for (const f of filters) {
      if (f.op === "eq") query = query.eq(f.col, f.val)
    }
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    out.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

async function ensureCategory(name, categoryByName) {
  const key = normalizeName(name)
  if (categoryByName.has(key)) return categoryByName.get(key)

  const { data, error } = await sb
    .from("donation_categories")
    .insert({ organization_id: args.orgId, name, is_active: true })
    .select("id, name")
    .single()

  if (error) throw new Error(`category insert (${name}): ${error.message}`)
  categoryByName.set(key, data)
  return data
}

async function ensureFund(name, categoryId, fundByName) {
  const key = normalizeName(name)
  if (fundByName.has(key)) return fundByName.get(key)

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
  return data
}

async function main() {
  const csv = readFileSync(args.file, "utf8")
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
  const rows = parsed.data

  const [plans, donors, contacts, categories, subcategories] = await Promise.all([
    fetchAll("recurring_donation_plans", [{ op: "eq", col: "organization_id", val: args.orgId }]),
    fetchAll("donors", [{ op: "eq", col: "organization_id", val: args.orgId }]),
    fetchAll("contacts", [{ op: "eq", col: "organization_id", val: args.orgId }]),
    fetchAll("donation_categories", [{ op: "eq", col: "organization_id", val: args.orgId }]),
    fetchAll("donation_subcategories", [{ op: "eq", col: "organization_id", val: args.orgId }]),
  ])

  const donorByContactId = new Map(
    donors.filter((d) => d.contact_id).map((d) => [d.contact_id, d])
  )
  const contactByEmail = new Map()
  const contactByName = new Map()
  for (const c of contacts) {
    const email = normalizeEmail(c.email)
    if (email) contactByEmail.set(email, c)
    const name = normalizeName(c.full_name)
    if (name) contactByName.set(name, c)
  }

  const categoryByName = new Map(categories.map((c) => [normalizeName(c.name), c]))
  const fundByName = new Map(subcategories.map((f) => [normalizeName(f.name), f]))

  const planByKey = new Map(
    plans.map((p) => [
      planLookupKey(p.donor_id, p.amount, p.frequency, p.category_id, p.subcategory_id),
      p,
    ])
  )

  function findDonor(row) {
    const email = normalizeEmail(row["Customer Email"])
    const name = normalizeName(row["Customer Name"])
    if (email && contactByEmail.has(email)) {
      return donorByContactId.get(contactByEmail.get(email).id) ?? null
    }
    if (name && contactByName.has(name)) {
      return donorByContactId.get(contactByName.get(name).id) ?? null
    }
    return null
  }

  function findContact(row) {
    const email = normalizeEmail(row["Customer Email"])
    const name = normalizeName(row["Customer Name"])
    if (email && contactByEmail.has(email)) return contactByEmail.get(email)
    if (name && contactByName.has(name)) return contactByName.get(name)
    return null
  }

  const report = {
    execute: args.execute,
    file: args.file,
    orgId: args.orgId,
    csvRows: rows.length,
    skippedQaysHawwar: 0,
    skippedNoDonor: 0,
    skippedInvalid: 0,
    plansCreated: 0,
    plansUpdated: 0,
    categoriesCreated: 0,
    fundsCreated: 0,
    errors: [],
    samples: [],
  }

  for (const row of rows) {
    const freqKey = normalizeText(row.Frequency).toUpperCase()
    const frequency = FREQ_MAP[freqKey]
    const amount = parseMoney(row.Amount)
    const startDate = parseDate(row["Plan Start Date"])
    const endDate = parseDate(row["Plan End Date"])
    const totalPayments = parseIntOrNull(row["Total Payments"])
    const paymentsMade = parseIntOrNull(row["Payments Made"])
    const status = mapStatus(row.Status)
    const customerName = normalizeText(row["Customer Name"])

    if (!frequency || amount <= 0 || !startDate) {
      report.skippedInvalid += 1
      continue
    }

    if (SKIP_DONOR_NAMES.has(normalizeName(customerName))) {
      report.skippedQaysHawwar += 1
      continue
    }

    const donor = findDonor(row)
    if (!donor) {
      report.skippedNoDonor += 1
      continue
    }

    const contact = findContact(row)
    const mapped = mapCategoryFund(row["Category/Fund"])

    if (args.execute) {
      const categoryBefore = categoryByName.size
      const fundBefore = fundByName.size
      const category = await ensureCategory(mapped.category, categoryByName)
      if (categoryByName.size > categoryBefore) report.categoriesCreated += 1

      let fund = null
      if (mapped.fund) {
        fund = await ensureFund(mapped.fund, category.id, fundByName)
        if (fundByName.size > fundBefore) report.fundsCreated += 1
      }

      const key = planLookupKey(donor.id, amount, frequency, category.id, fund?.id ?? null)
      const existing = planByKey.get(key)
      const nextPaymentDate = computeNextPaymentDate(
        startDate,
        frequency,
        status,
        paymentsMade ?? 0
      )

      const payload = {
        status,
        start_date: startDate,
        end_date: endDate,
        next_payment_date: nextPaymentDate,
        total_payments: totalPayments,
        payments_made: paymentsMade,
        external_processor: "square",
        notes: existing?.notes || `${IMPORT_TAG}|${normalizeText(row["Category/Fund"])}`,
      }

      if (existing) {
        const { error } = await sb
          .from("recurring_donation_plans")
          .update(payload)
          .eq("id", existing.id)

        if (error) {
          report.errors.push({ action: "update", name: customerName, error: error.message })
        } else {
          report.plansUpdated += 1
        }
      } else {
        const { data, error } = await sb
          .from("recurring_donation_plans")
          .insert({
            organization_id: args.orgId,
            donor_id: donor.id,
            contact_id: contact?.id ?? donor.contact_id ?? null,
            category_id: category.id,
            subcategory_id: fund?.id ?? null,
            amount,
            frequency,
            ...payload,
          })
          .select("id")
          .single()

        if (error) {
          report.errors.push({ action: "insert", name: customerName, error: error.message })
        } else {
          report.plansCreated += 1
          planByKey.set(key, { id: data.id, ...payload, donor_id: donor.id, amount, frequency })
          if (report.samples.length < 12) {
            report.samples.push({
              action: "created",
              name: customerName || row["Customer Email"],
              amount,
              frequency,
              categoryFund: row["Category/Fund"],
              status: row.Status,
            })
          }
        }
      }
    } else {
      const category = categoryByName.get(normalizeName(mapped.category))
      const fund = mapped.fund ? fundByName.get(normalizeName(mapped.fund)) : null
      const key = planLookupKey(
        donor.id,
        amount,
        frequency,
        category?.id ?? null,
        fund?.id ?? null
      )
      if (planByKey.has(key)) report.plansUpdated += 1
      else {
        report.plansCreated += 1
        if (report.samples.length < 12) {
          report.samples.push({
            action: "would_create",
            name: customerName || row["Customer Email"],
            amount,
            frequency,
            categoryFund: row["Category/Fund"],
            status: row.Status,
          })
        }
      }
    }
  }

  const reportsDir = resolve(root, "scripts/reports")
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `madina-recurring-plans-import-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(args.execute ? "EXECUTED" : "DRY RUN")
  console.log(JSON.stringify(report, null, 2))
  console.log("Report:", reportPath)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
