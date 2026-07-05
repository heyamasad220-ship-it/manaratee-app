/**
 * Create recurring_donation_plans from Square-imported payments and link them.
 *
 * Groups imported payments by donor + amount + frequency + category/fund to
 * create one plan per unique recurring schedule. Links each payment to its plan
 * via recurring_donation_plan_id.
 *
 * Usage:
 *   node scripts/link-square-recurring-plans.mjs                  # dry run
 *   node scripts/link-square-recurring-plans.mjs --execute        # apply
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
const DEFAULT_FILE = "C:/Users/danan/Downloads/MadinaDonationsActive07032026.csv"
const IMPORT_TAG = "MADINA_SQUARE_DONATIONS_V1"
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
  const args = { file: DEFAULT_FILE, orgId: DEFAULT_ORG_ID, execute: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--file") args.file = argv[++i]
    else if (argv[i] === "--org") args.orgId = argv[++i]
  }
  return args
}

function normalizeText(v) { return String(v ?? "").trim() }
function normalizeLabel(v) { return normalizeText(v).replace(/\s+/g, " ") }
function normalizeName(v) {
  return normalizeText(v).toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
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

const CSV_FREQUENCY_MAP = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
}

const MIN_INFERRED_PAYMENTS = 4
const MIN_INFERRED_SPAN_DAYS = 14

function inferFrequencyFromDates(dateStrings) {
  if (dateStrings.length < 2) return null

  const sorted = [...dateStrings].sort()
  const gaps = []
  for (let index = 1; index < sorted.length; index += 1) {
    const diff =
      (new Date(sorted[index]).getTime() - new Date(sorted[index - 1]).getTime()) /
      86_400_000
    gaps.push(diff)
  }

  gaps.sort((left, right) => left - right)
  const median = gaps[Math.floor(gaps.length / 2)]

  if (median <= 2.5) return "daily"
  if (median <= 10) return "weekly"
  if (median <= 45) return "monthly"
  return null
}

function paymentDateOnly(payment) {
  return String(payment.payment_date || "").slice(0, 10)
}

function planLookupKey(donorId, amount, frequency, categoryId, subcategoryId) {
  return [
    donorId,
    Number(amount).toFixed(2),
    frequency,
    categoryId || "",
    subcategoryId || "",
  ].join("|")
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
  const rows = []
  let from = 0
  while (true) {
    let query = sb.from(table).select("*").range(from, from + 999)
    for (const f of filters) {
      if (f.op === "eq") query = query.eq(f.col, f.val)
      else if (f.op === "like") query = query.like(f.col, f.val)
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
  const csv = readFileSync(args.file, "utf8")
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
  const csvRows = parsed.data

  const payments = await fetchAll("payments", [
    { op: "eq", col: "organization_id", val: args.orgId },
    { op: "like", col: "memo", val: `${IMPORT_TAG}|%` },
  ])

  console.log("Imported payments found:", payments.length)

  const paymentsByHash = new Map()
  for (const p of payments) {
    const match = String(p.memo || "").match(new RegExp(`${IMPORT_TAG}\\|([a-f0-9]{12})`))
    if (match) paymentsByHash.set(match[1], p)
  }

  const csvRecurring = csvRows.filter((r) => {
    const freq = CSV_FREQUENCY_MAP[normalizeText(r["Recurring Type"])]
    return (
      freq &&
      r.Status === "succeeded" &&
      r["Transaction Type"] === "CREDIT" &&
      parseMoney(r.Amount) > 0 &&
      parseDate(r["Transaction Date"])
    )
  })

  console.log("CSV recurring rows (DAILY/WEEKLY/MONTHLY):", csvRecurring.length)

  const planGroups = new Map()

  for (const row of csvRecurring) {
    const freq = CSV_FREQUENCY_MAP[normalizeText(row["Recurring Type"])]
    const amount = parseMoney(row.Amount)
    const name = normalizeText(row["Customer Name"]) || normalizeEmail(row["Customer Email"]).split("@")[0]
    const email = normalizeEmail(row["Customer Email"])
    const category = normalizeLabel(row.Category)
    const fund = normalizeLabel(row.Fund) || ""
    const date = parseDate(row["Transaction Date"])

    const groupKey = [
      normalizeName(name),
      amount.toFixed(2),
      freq,
      normalizeName(category),
      normalizeName(fund),
    ].join("|")

    if (!planGroups.has(groupKey)) {
      planGroups.set(groupKey, {
        name,
        email,
        amount,
        frequency: freq,
        category,
        fund,
        dates: [],
        csvRows: [],
      })
    }

    const group = planGroups.get(groupKey)
    group.dates.push(date)
    group.csvRows.push(row)
  }

  console.log("Unique recurring plan groups:", planGroups.size)

  const categories = await fetchAll("donation_categories", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])
  const subcategories = await fetchAll("donation_subcategories", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])
  const donors = await fetchAll("donors", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])

  const categoryByName = new Map(categories.map((c) => [normalizeName(c.name), c]))
  const fundByName = new Map(subcategories.map((f) => [normalizeName(f.name), f]))
  const donorByContactId = new Map(
    donors.filter((d) => d.contact_id).map((d) => [d.contact_id, d])
  )

  const contacts = await fetchAll("contacts", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])
  const contactByEmail = new Map()
  const contactByName = new Map()
  for (const c of contacts) {
    const email = normalizeEmail(c.email)
    if (email) contactByEmail.set(email, c)
    const nameKey = normalizeName(c.full_name)
    if (nameKey) contactByName.set(nameKey, c)
  }

  function findContact(group) {
    const email = normalizeEmail(group.email)
    if (email && contactByEmail.has(email)) return contactByEmail.get(email)
    const nameKey = normalizeName(group.name)
    if (nameKey && contactByName.has(nameKey)) return contactByName.get(nameKey)
    return null
  }

  function findDonor(contact) {
    if (!contact) return null
    return donorByContactId.get(contact.id) || null
  }

  const report = {
    execute: args.execute,
    totalCsvRecurring: csvRecurring.length,
    planGroups: planGroups.size,
    inferredPlanGroups: 0,
    plansCreated: 0,
    plansReused: 0,
    paymentsLinked: 0,
    skippedNoDonor: 0,
    skippedNoPayment: 0,
    skippedAlreadyLinked: 0,
    errors: [],
    samples: [],
  }

  const today = new Date().toISOString().slice(0, 10)
  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - 60)
  const recentCutoffStr = recentCutoff.toISOString().slice(0, 10)

  const existingPlanByKey = new Map()
  const existingPlans = await fetchAll("recurring_donation_plans", [
    { op: "eq", col: "organization_id", val: args.orgId },
  ])
  for (const plan of existingPlans) {
    existingPlanByKey.set(
      planLookupKey(
        plan.donor_id,
        plan.amount,
        plan.frequency,
        plan.category_id,
        plan.subcategory_id
      ),
      plan
    )
  }

  async function createOrReusePlanAndLinkPayments(group, paymentList) {
    const contact = findContact(group)
    const donor = findDonor(contact)

    if (!donor) {
      report.skippedNoDonor += 1
      return
    }

    const dates = paymentList
      .map((payment) => paymentDateOnly(payment))
      .filter(Boolean)
      .sort()

    if (dates.length === 0) return

    const startDate = dates[0]
    const lastDate = dates.at(-1)
    const isActive = lastDate >= recentCutoffStr
    const status = isActive ? "active" : "completed"

    const category = categoryByName.get(normalizeName(group.category)) || null
    const fund = group.fund ? fundByName.get(normalizeName(group.fund)) || null : null

    let nextPaymentDate = today
    if (isActive) {
      const last = new Date(lastDate)
      switch (group.frequency) {
        case "daily":
          last.setDate(last.getDate() + 1)
          break
        case "weekly":
          last.setDate(last.getDate() + 7)
          break
        case "monthly":
          last.setMonth(last.getMonth() + 1)
          break
      }
      nextPaymentDate = last.toISOString().slice(0, 10)
      if (nextPaymentDate < today) nextPaymentDate = today
    }

    const lookupKey = planLookupKey(
      donor.id,
      group.amount,
      group.frequency,
      category?.id ?? null,
      fund?.id ?? null
    )

    let planId = existingPlanByKey.get(lookupKey)?.id ?? null
    if (planId) {
      report.plansReused += 1
    } else if (args.execute) {
      const { data, error } = await sb
        .from("recurring_donation_plans")
        .insert({
          organization_id: args.orgId,
          donor_id: donor.id,
          contact_id: contact?.id ?? null,
          campaign_id: null,
          category_id: category?.id ?? null,
          subcategory_id: fund?.id ?? null,
          amount: group.amount,
          frequency: group.frequency,
          status,
          start_date: startDate,
          next_payment_date: nextPaymentDate,
          end_date: status === "completed" ? lastDate : null,
          notes: group.inferred
            ? `Inferred recurring from Square import — ${dates.length} payments`
            : `Imported from Square — ${dates.length} payments`,
          external_processor: "square",
        })
        .select("id")
        .single()

      if (error) throw new Error(`plan insert: ${error.message}`)
      planId = data.id
      existingPlanByKey.set(lookupKey, { id: planId })
      report.plansCreated += 1
    } else {
      report.plansCreated += 1
    }

    let linkedInGroup = 0
    for (const payment of paymentList) {
      if (payment.recurring_donation_plan_id) {
        report.skippedAlreadyLinked += 1
        continue
      }

      if (args.execute && planId) {
        const { error } = await sb
          .from("payments")
          .update({ recurring_donation_plan_id: planId })
          .eq("id", payment.id)
          .eq("organization_id", args.orgId)

        if (error) {
          report.errors.push({ paymentId: payment.id, error: error.message })
          continue
        }
      }

      linkedInGroup += 1
      report.paymentsLinked += 1
    }

    if (report.samples.length < 12) {
      report.samples.push({
        donor: group.name,
        amount: group.amount,
        frequency: group.frequency,
        category: group.category,
        fund: group.fund || null,
        paymentCount: dates.length,
        linked: linkedInGroup,
        status,
        inferred: Boolean(group.inferred),
        startDate,
        lastDate,
      })
    }
  }

  for (const [groupKey, group] of planGroups) {
    try {
      const { createHash } = await import("node:crypto")
      const groupPayments = []

      for (const csvRow of group.csvRows) {
        const dedupeKey = [
          normalizeName(
            normalizeText(csvRow["Customer Name"]) ||
              normalizeEmail(csvRow["Customer Email"]).split("@")[0]
          ),
          parseMoney(csvRow.Amount).toFixed(2),
          parseDate(csvRow["Transaction Date"]),
          normalizeName(csvRow.Category),
          normalizeName(csvRow.Fund || ""),
        ].join("|")
        const hash = createHash("sha256").update(dedupeKey).digest("hex").slice(0, 12)
        const payment = paymentsByHash.get(hash)
        if (!payment) {
          report.skippedNoPayment += 1
          continue
        }
        groupPayments.push(payment)
      }

      await createOrReusePlanAndLinkPayments(group, groupPayments)
    } catch (error) {
      report.errors.push({
        group: groupKey,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const unlinkedPayments = payments.filter((payment) => !payment.recurring_donation_plan_id)
  const inferredGroups = new Map()

  for (const payment of unlinkedPayments) {
    const donorId = payment.donor_id
    if (!donorId) continue

    const groupKey = [
      donorId,
      Number(payment.amount).toFixed(2),
      payment.category_id || "",
      payment.subcategory_id || "",
    ].join("|")

    if (!inferredGroups.has(groupKey)) {
      inferredGroups.set(groupKey, {
        donorId,
        amount: Number(payment.amount),
        categoryId: payment.category_id,
        subcategoryId: payment.subcategory_id,
        payments: [],
      })
    }

    inferredGroups.get(groupKey).payments.push(payment)
  }

  for (const [groupKey, group] of inferredGroups) {
    if (group.payments.length < MIN_INFERRED_PAYMENTS) continue

    const dates = group.payments.map((payment) => paymentDateOnly(payment)).filter(Boolean).sort()
    const spanDays =
      (new Date(dates.at(-1)).getTime() - new Date(dates[0]).getTime()) / 86_400_000
    if (spanDays < MIN_INFERRED_SPAN_DAYS) continue

    const frequency = inferFrequencyFromDates(dates)
    if (!frequency) continue

    const donor = donors.find((row) => row.id === group.donorId)
    if (!donor) {
      report.skippedNoDonor += 1
      continue
    }

    const category = categories.find((row) => row.id === group.categoryId)
    const fund = subcategories.find((row) => row.id === group.subcategoryId)

    report.inferredPlanGroups += 1

    try {
      await createOrReusePlanAndLinkPayments(
        {
          name: donor.full_name || "Unknown",
          email: donor.email,
          amount: group.amount,
          frequency,
          category: category?.name || "General Donation",
          fund: fund?.name || "",
          inferred: true,
        },
        group.payments
      )
    } catch (error) {
      report.errors.push({
        group: `inferred:${groupKey}`,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `square-recurring-plans-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nReport: ${reportPath}`)
  if (!args.execute) {
    console.log("\nDry run. Re-run with --execute to apply.")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
