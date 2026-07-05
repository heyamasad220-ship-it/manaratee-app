import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CSV_PATH = "C:/Users/danan/Downloads/MadinaDonationsActive07032026.csv"
const ORG = "e057e00a-e4e3-4adf-9af5-f465db1894be"

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

function normName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normLabel(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}

function parseMoney(value) {
  const parsed = Number(String(value ?? "").replace(/[$,]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

loadEnvLocal()

const csv = readFileSync(CSV_PATH, "utf8")
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
const rows = parsed.data

console.log("=== FILE STRUCTURE ===")
console.log("Columns:", Object.keys(rows[0] ?? {}))
console.log("Total rows:", rows.length)
if (parsed.errors.length) {
  console.log("Parse errors:", parsed.errors.slice(0, 5))
}

const badAmount = rows.filter((row) => parseMoney(row.Amount) <= 0)
const refunded = rows.filter(
  (row) =>
    row.Status === "refunded" ||
    row["Transaction Type"] === "DEBIT" ||
    parseMoney(row.Amount) < 0
)
const noName = rows.filter((row) => !String(row["Customer Name"] ?? "").trim())
const noEmail = rows.filter((row) => !String(row["Customer Email"] ?? "").trim())
const badDate = rows.filter((row) => !parseDate(row["Transaction Date"]))
const noCategory = rows.filter((row) => !normLabel(row.Category))
const succeeded = rows.filter(
  (row) =>
    row.Status === "succeeded" &&
    row["Transaction Type"] === "CREDIT" &&
    parseMoney(row.Amount) > 0 &&
    parseDate(row["Transaction Date"])
)

console.log("\n=== ROW QUALITY ===")
console.log("Succeeded credits (amount > 0, valid date):", succeeded.length)
console.log("Refunded/debit/negative:", refunded.length)
console.log("Zero/invalid amount:", badAmount.length)
console.log("Missing customer name:", noName.length)
console.log("Missing email:", noEmail.length)
console.log("Missing category:", noCategory.length)
console.log("Bad transaction date:", badDate.length)

if (refunded.length) {
  console.log("\nRefund samples:")
  for (const row of refunded.slice(0, 5)) {
    console.log(" ", row["Customer Name"], row.Amount, row.Status, row["Transaction Date"])
  }
}

if (noName.length) {
  console.log("\nNo-name samples:")
  for (const row of noName.slice(0, 5)) {
    console.log(" ", row["Customer Email"], row.Amount, row.Category, row.Fund)
  }
}

const categoryCounts = new Map()
const fundCounts = new Map()
const fundByCategory = new Map()
for (const row of succeeded) {
  const category = normLabel(row.Category)
  const fund = normLabel(row.Fund)
  categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
  if (fund) {
    fundCounts.set(fund, (fundCounts.get(fund) ?? 0) + 1)
    const key = `${category} → ${fund}`
    fundByCategory.set(key, (fundByCategory.get(key) ?? 0) + 1)
  }
}

const weirdLabels = [...categoryCounts.keys(), ...fundCounts.keys()].filter(
  (label) => label.includes('"') || /\s{2,}/.test(label) || label !== label.trim()
)

console.log("\n=== CATEGORIES & FUNDS ===")
console.log("Unique categories:", categoryCounts.size)
console.log("Rows with fund set:", succeeded.filter((row) => normLabel(row.Fund)).length)
console.log("Unique funds:", fundCounts.size)

if (weirdLabels.length) {
  console.log("\nLabels with quoting/spacing issues:")
  for (const label of weirdLabels) console.log(" ", JSON.stringify(label))
}

console.log("\nCategories (count):")
for (const [category, count] of [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${category}: ${count}`)
}

if (fundCounts.size) {
  console.log("\nFunds (count):")
  for (const [fund, count] of [...fundCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${fund}: ${count}`)
  }
  console.log("\nCategory → Fund mappings:")
  for (const [mapping, count] of [...fundByCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${mapping}: ${count}`)
  }
}

const recurringBreakdown = {}
for (const row of succeeded) {
  recurringBreakdown[row["Recurring Type"]] =
    (recurringBreakdown[row["Recurring Type"]] ?? 0) + 1
}
console.log("\nRecurring types:", recurringBreakdown)

const dates = succeeded.map((row) => parseDate(row["Transaction Date"])).sort()
console.log("Date range:", dates[0], "to", dates.at(-1))

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data: categories, error: catError } = await sb
  .from("donation_categories")
  .select("id, name")
  .eq("organization_id", ORG)

const { data: subcategories, error: subError } = await sb
  .from("donation_subcategories")
  .select("id, name, category_id, donation_categories(name)")
  .eq("organization_id", ORG)

if (catError) throw new Error(catError.message)
if (subError) throw new Error(subError.message)

const existingCategoryNames = new Set((categories ?? []).map((row) => normName(row.name)))
const existingFundNames = new Set((subcategories ?? []).map((row) => normName(row.name)))

const csvCategories = [...categoryCounts.keys()]
const csvFunds = [...fundCounts.keys()]

const missingCategories = csvCategories.filter(
  (category) => !existingCategoryNames.has(normName(category))
)
const missingFunds = csvFunds.filter((fund) => !existingFundNames.has(normName(fund)))

console.log("\n=== DB COMPARISON ===")
console.log("Existing categories in DB:", categories?.length ?? 0)
console.log("Existing funds (subcategories) in DB:", subcategories?.length ?? 0)
console.log("Missing categories:", missingCategories.length)
if (missingCategories.length) {
  for (const category of missingCategories.sort()) {
    console.log(`  ${category} (${categoryCounts.get(category)})`)
  }
}
console.log("Missing funds:", missingFunds.length)
if (missingFunds.length) {
  for (const fund of missingFunds.sort()) {
    console.log(`  ${fund} (${fundCounts.get(fund)})`)
  }
}

const allPayments = []
for (let page = 0; page < 50; page += 1) {
  const { data, error } = await sb
    .from("payments")
    .select("amount, sender_name, payment_date, status, donor_id, memo, category_id")
    .eq("organization_id", ORG)
    .neq("status", "voided")
    .range(page * 1000, page * 1000 + 999)

  if (error) throw new Error(error.message)
  if (!data?.length) break
  allPayments.push(...data)
  if (data.length < 1000) break
}

const { data: donors } = await sb
  .from("donors")
  .select("id, full_name, contact_id, contacts(full_name)")
  .eq("organization_id", ORG)

const donorNameById = new Map()
for (const donor of donors ?? []) {
  const name = normName(donor.contacts?.full_name || donor.full_name || "")
  if (name) donorNameById.set(donor.id, name)
}

function rowDisplayName(row) {
  return normName(row["Customer Name"] || row["Customer Email"]?.split("@")[0] || "")
}

function dedupeKey(row, includeDate = false, includeCategory = false) {
  const name = rowDisplayName(row)
  const amount = parseMoney(row.Amount).toFixed(2)
  let key = `${name}|${amount}`
  if (includeDate) key += `|${parseDate(row["Transaction Date"])}`
  if (includeCategory) key += `|${normName(row.Category)}`
  return key
}

const existingDonorAmount = new Set()
const existingDonorAmountDate = new Set()
const existingDonorAmountDateCategory = new Set()
const campaignDonorAmount = new Set()

for (const payment of allPayments) {
  const name =
    normName(payment.sender_name || "") || donorNameById.get(payment.donor_id || "") || ""
  const amount = Number(payment.amount).toFixed(2)
  const date = payment.payment_date ? String(payment.payment_date).slice(0, 10) : ""
  if (!name) continue
  existingDonorAmount.add(`${name}|${amount}`)
  if (date) existingDonorAmountDate.add(`${name}|${amount}|${date}`)
  if (String(payment.memo ?? "").startsWith("MAS_CAMPAIGN_LEDGER_V1")) {
    campaignDonorAmount.add(`${name}|${amount}`)
  }
}

let skipDonorAmount = 0
let skipDonorAmountDate = 0
let skipDonorAmountDateCategory = 0
let skipCampaignOnly = 0
let wouldImport = 0

for (const row of succeeded) {
  if (existingDonorAmount.has(dedupeKey(row))) skipDonorAmount += 1
  if (existingDonorAmountDate.has(dedupeKey(row, true))) skipDonorAmountDate += 1
  if (existingDonorAmountDateCategory.has(dedupeKey(row, true, true))) {
    skipDonorAmountDateCategory += 1
  }
  if (campaignDonorAmount.has(dedupeKey(row))) skipCampaignOnly += 1

  if (!existingDonorAmountDateCategory.has(dedupeKey(row, true, true))) {
    wouldImport += 1
  }
}

console.log("\n=== DEDUPE ESTIMATES ===")
console.log("Existing non-voided payments:", allPayments.length)
console.log("Skip donor+amount (all DB):", skipDonorAmount)
console.log("Skip donor+amount+date:", skipDonorAmountDate)
console.log("Skip donor+amount+date+category:", skipDonorAmountDateCategory)
console.log("Skip donor+amount (campaign imports only):", skipCampaignOnly)
console.log("Would import (donor+amount+date+category not in DB):", wouldImport)

const sameDaySameAmt = new Map()
for (const row of succeeded) {
  const key = dedupeKey(row, true)
  sameDaySameAmt.set(key, (sameDaySameAmt.get(key) ?? 0) + 1)
}
const sameDayDupes = [...sameDaySameAmt.entries()].filter(([, count]) => count > 1)
console.log("\nSame donor+amount+date groups:", sameDayDupes.length)
console.log(
  "Extra rows in those groups:",
  sameDayDupes.reduce((sum, [, count]) => sum + count - 1, 0)
)
for (const [key, count] of sameDayDupes.slice(0, 6)) {
  const matching = succeeded.filter((row) => dedupeKey(row, true) === key)
  console.log(
    `  ${key} x${count}:`,
    matching.map((row) => `${row.Category}${row.Fund ? ` / ${row.Fund}` : ""}`)
  )
}
