/**
 * Probe allowed program_payment_plans.status values and repair Sunday School plans.
 * Usage: node scripts/repair-sunday-school-tuition-plans.mjs --execute
 */
import { createRequire } from "node:module"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { createHash } from "node:crypto"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const IMPORT_TAG = "SUNDAY_SCHOOL_2026_27_V1"
const PROGRAM_NAME = "Sunday School 2026-2027"
const DEFAULT_XLSX = "C:/Users/danan/Downloads/SundaySchool_2026-2027.xlsx"
const BASE_FEE = 120
const SIBLING_FEE = 114

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

function norm(v) {
  return String(v ?? "").trim()
}
function normEmail(v) {
  const e = norm(v).toLowerCase()
  return e.includes("@") ? e : null
}
function digitsPhone(v) {
  const d = String(v || "").replace(/\D/g, "")
  if (d.length === 11 && d.startsWith("1")) return d.slice(1)
  if (d.length >= 10) return d.slice(-10)
  return null
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}
function excelSerialToIso(serial) {
  const n = Number(serial)
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return null
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
    .toISOString()
    .slice(0, 10)
}
function addMonthsIso(startIso, index) {
  const d = new Date(`${startIso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + index)
  return d.toISOString().slice(0, 10)
}
function parseEmergency(value) {
  const raw = norm(value)
  if (!raw) return { phone: null, email: null }
  const parts = raw.split(",").map((p) => p.trim())
  return {
    phone: digitsPhone(parts[0]),
    email: parts.slice(1).map(normEmail).find(Boolean) || null,
  }
}

loadEnvLocal()
const execute = process.argv.includes("--execute")
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const candidates = [
  "scheduled",
  "pending",
  "open",
  "due",
  "active",
  "unpaid",
  "future",
  "planned",
  "installment",
]

// Find one enrollment to probe
const { data: sampleEnroll } = await sb
  .from("program_enrollments")
  .select("id")
  .eq("organization_id", ORG_ID)
  .ilike("notes", `%${IMPORT_TAG}%`)
  .limit(1)
  .maybeSingle()

if (!sampleEnroll?.id) {
  console.error("No Sunday School enrollment found to probe status values.")
  process.exit(1)
}

const allowed = []
for (const status of candidates) {
  const row = {
    enrollment_id: sampleEnroll.id,
    installment_amount: 0.01,
    due_date: "2099-01-01",
    status,
  }
  // try with org id
  let ins = await sb.from("program_payment_plans").insert({
    ...row,
    organization_id: ORG_ID,
  })
  if (ins.error && /organization_id does not exist/i.test(ins.error.message)) {
    ins = await sb.from("program_payment_plans").insert(row)
  }
  if (!ins.error) {
    allowed.push(status)
    await sb
      .from("program_payment_plans")
      .delete()
      .eq("enrollment_id", sampleEnroll.id)
      .eq("due_date", "2099-01-01")
  }
}

console.log("allowed statuses:", allowed)
if (allowed.length === 0) {
  console.error("No allowed status values found.")
  process.exit(1)
}

const STATUS = allowed.includes("scheduled")
  ? "scheduled"
  : allowed.includes("pending")
    ? "pending"
    : allowed[0]

if (!execute) {
  console.log(`Dry-run only. Would use status="${STATUS}". Pass --execute to repair.`)
  process.exit(0)
}

const wb = XLSX.readFile(DEFAULT_XLSX)
const regs = XLSX.utils.sheet_to_json(wb.Sheets.Registrations, { defval: null })
const subs = XLSX.utils.sheet_to_json(wb.Sheets.Subscriptions, { defval: null })

const { data: program } = await sb
  .from("programs")
  .select("id, start_date, end_date")
  .eq("organization_id", ORG_ID)
  .ilike("name", PROGRAM_NAME)
  .maybeSingle()

const { data: enrollments } = await sb
  .from("program_enrollments")
  .select("id, child_name, notes, amount_paid, total_amount, parent_email, parent_phone")
  .eq("organization_id", ORG_ID)
  .eq("program_id", program.id)
  .ilike("notes", `%${IMPORT_TAG}%`)

const report = { statusUsed: STATUS, repaired: 0, errors: [], enrollments: enrollments?.length || 0 }

for (const enr of enrollments || []) {
  const keyMatch = /Import key:\s*([a-f0-9]+)/i.exec(enr.notes || "")
  const importKey = keyMatch?.[1] || null

  // Find family size / fee from workbook by child name + parent contact
  const childRows = regs.filter(
    (r) => norm(r["Participant Name"]).toLowerCase() === norm(enr.child_name).toLowerCase()
  )
  // Default one installment of total_amount
  let planCount = 1
  let installment = Number(enr.total_amount || BASE_FEE)
  let start = program.start_date || "2026-09-01"

  const parentEmail = normEmail(enr.parent_email)
  const parentPhone = digitsPhone(enr.parent_phone)
  const sub =
    subs.find((s) => normEmail(s["Customer Email"]) === parentEmail) ||
    subs.find((s) => digitsPhone(s.Phone) === parentPhone) ||
    null
  if (sub) {
    start = excelSerialToIso(sub["Subscription Start Date"]) || start
    // Keep single installment equal to enrollment total (season fee)
    planCount = 1
    installment = Number(enr.total_amount || BASE_FEE)
  }

  await sb.from("program_payment_plans").delete().eq("enrollment_id", enr.id)

  const rows = Array.from({ length: planCount }, (_, i) => ({
    organization_id: ORG_ID,
    enrollment_id: enr.id,
    installment_amount: installment,
    due_date: addMonthsIso(start, i),
    status: STATUS,
  }))

  let ins = await sb.from("program_payment_plans").insert(rows)
  if (ins.error && /organization_id does not exist/i.test(ins.error.message)) {
    ins = await sb
      .from("program_payment_plans")
      .insert(rows.map(({ organization_id: _o, ...rest }) => rest))
  }
  if (ins.error) {
    report.errors.push({ child: enr.child_name, error: ins.error.message })
  } else {
    report.repaired += 1
  }
}

mkdirSync(resolve(root, "scripts/reports"), { recursive: true })
const out = resolve(root, "scripts/reports/sunday-school-tuition-plans-repair.json")
writeFileSync(out, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
