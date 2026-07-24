/**
 * Import QIL 2025–26 teacher payroll CSV into department_staff_pay_entries.
 *
 * Source: QIL-Teacher_Payments_2526.csv (Sept 2025 – April 2026).
 * - Hourly teachers: hours + payment; updates staff.hourly_rate / pay_basis=hourly
 * - Fadia Salameh: monthly salary (no hours); pay_basis=monthly
 * - Status: approved (for Financial Summary)
 *
 * Usage (dry-run by default):
 *   node scripts/import-qil-teacher-payroll.mjs
 *   node scripts/import-qil-teacher-payroll.mjs --csv "C:/Users/danan/Downloads/QIL-Teacher_Payments_2526.csv"
 *   node scripts/import-qil-teacher-payroll.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local for --execute.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "QIL_TEACHER_PAYROLL_2526_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "c:/Users/danan/Downloads/QIL-Teacher_Payments_2526.csv"
const DEPARTMENT_ALIASES = [
  "Qur'an Institute for Ladies",
  "Quran Institute for Ladies",
]

/** CSV name (normalized) → preferred staff/contact display name in DB. */
const TEACHER_NAME_ALIASES = {
  "fathieh alaeddin": "Fathieh Alladin",
  "abeer abu kawan": "Abeer Abu Kiwan",
  "amneh ismail": "Amneh Ismail",
  "rajaa aljaber": "Rajaa Eljaber",
  "zohor hawa": "Zohour Hawa",
  "fadia salameh": "Fadia Salameh",
  "souzan ayoub": "Souzan Ayoub",
  "wedad atwan": "Wedad Atwan",
}

const MONTHS = [
  { label: "September", periodKey: "2025-09", periodStart: "2025-09-01", periodEnd: "2025-09-30" },
  { label: "October", periodKey: "2025-10", periodStart: "2025-10-01", periodEnd: "2025-10-31" },
  { label: "November", periodKey: "2025-11", periodStart: "2025-11-01", periodEnd: "2025-11-30" },
  { label: "December", periodKey: "2025-12", periodStart: "2025-12-01", periodEnd: "2025-12-31" },
  { label: "January", periodKey: "2026-01", periodStart: "2026-01-01", periodEnd: "2026-01-31" },
  { label: "February", periodKey: "2026-02", periodStart: "2026-02-01", periodEnd: "2026-02-28" },
  { label: "March", periodKey: "2026-03", periodStart: "2026-03-01", periodEnd: "2026-03-31" },
  { label: "April", periodKey: "2026-04", periodStart: "2026-04-01", periodEnd: "2026-04-30" },
]

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
    csv: DEFAULT_CSV,
    execute: false,
    orgId: DEFAULT_ORG_ID,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--csv") args.csv = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
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

function parseMoney(value) {
  if (value == null || value === "") return null
  const text = String(value).trim()
  if (!text) return null
  const n = Number(text.replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function parseHours(value) {
  if (value == null || value === "") return null
  const text = String(value).trim()
  if (!text) return null
  const n = Number(text.replace(/[,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "Unknown", last: "" }
  if (parts.length === 1) return { first: parts[0], last: "" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

/**
 * CSV layout (2 header rows):
 * Row0: blank, blank, September,, October,, ...
 * Row1: Name, Hourly Pay, Hours, Payment, Hours, Payment, ...
 * Data: Name, rate, then 8× (hours, payment)
 */
function parsePayrollCsv(filePath) {
  const raw = readFileSync(filePath, "utf8")
  const parsed = Papa.parse(raw, { header: false, skipEmptyLines: true })
  const rows = parsed.data || []
  if (rows.length < 3) {
    throw new Error("CSV looks empty or missing data rows.")
  }

  const teachers = []
  for (let i = 2; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row || !normalizeText(row[0])) continue

    const csvName = normalizeText(row[0])
    const key = normalizeName(csvName)
    const canonicalName = TEACHER_NAME_ALIASES[key] || csvName
    const hourlyRate = parseMoney(row[1])

    const months = MONTHS.map((month, index) => {
      const hoursCol = 2 + index * 2
      const payCol = 3 + index * 2
      return {
        ...month,
        hours: parseHours(row[hoursCol]),
        payment: parseMoney(row[payCol]),
      }
    })

    const hasAnyPayment = months.some((m) => m.payment != null && m.payment > 0)
    if (!hasAnyPayment) continue

    const isMonthly =
      key === "fadia salameh" ||
      (hourlyRate == null && months.every((m) => m.hours == null))

    teachers.push({
      csvName,
      canonicalName,
      matchKey: normalizeName(canonicalName),
      csvKey: key,
      isMonthly,
      hourlyRate: isMonthly ? null : hourlyRate,
      monthlySalary: isMonthly
        ? months.find((m) => m.payment != null)?.payment ?? null
        : null,
      months,
    })
  }

  return teachers
}

async function resolveDepartment(sb, orgId) {
  for (const name of DEPARTMENT_ALIASES) {
    const { data, error } = await sb
      .from("departments")
      .select("id, name")
      .eq("organization_id", orgId)
      .ilike("name", name)
      .maybeSingle()
    if (error) throw new Error(`department lookup: ${error.message}`)
    if (data) return data
  }

  const { data: fuzzy, error: fuzzyError } = await sb
    .from("departments")
    .select("id, name")
    .eq("organization_id", orgId)
    .or("name.ilike.%Institute for Ladies%,name.ilike.%Qur%an Institute%")
    .limit(5)
  if (fuzzyError) throw new Error(`department fuzzy: ${fuzzyError.message}`)
  if (fuzzy?.length === 1) return fuzzy[0]
  if (fuzzy?.length > 1) {
    throw new Error(
      `Multiple departments matched QIL: ${fuzzy.map((d) => d.name).join(", ")}`
    )
  }
  throw new Error("QIL department not found. Run QIL year import first.")
}

async function loadDepartmentStaff(sb, orgId, departmentId) {
  const { data, error } = await sb
    .from("staff")
    .select(
      "id, contact_id, first_name, last_name, department_id, pay_basis, hourly_rate, monthly_salary, status"
    )
    .eq("organization_id", orgId)
    .eq("department_id", departmentId)

  if (error) throw new Error(`load staff: ${error.message}`)

  const byName = new Map()
  for (const row of data || []) {
    const full = `${row.first_name || ""} ${row.last_name || ""}`.trim()
    const key = normalizeName(full)
    if (key) byName.set(key, row)
  }
  return { rows: data || [], byName }
}

function findStaff(byName, teacher) {
  const keys = [
    teacher.matchKey,
    teacher.csvKey,
    normalizeName(teacher.csvName),
    normalizeName(teacher.canonicalName),
  ]
  for (const key of keys) {
    if (byName.has(key)) return byName.get(key)
  }
  // Loose: last-name + first initial / contains
  for (const [key, row] of byName.entries()) {
    if (key.includes(teacher.matchKey) || teacher.matchKey.includes(key)) {
      return row
    }
  }
  return null
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const csvPath = resolve(args.csv)

  if (!existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  const teachers = parsePayrollCsv(csvPath)
  console.log(
    `Parsed ${teachers.length} teachers from ${csvPath} (${args.execute ? "EXECUTE" : "dry-run"})`
  )

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const department = await resolveDepartment(sb, args.orgId)
  console.log(`Department: ${department.name} (${department.id})`)

  const { byName } = await loadDepartmentStaff(sb, args.orgId, department.id)

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    csvPath,
    organizationId: args.orgId,
    department: { id: department.id, name: department.name },
    periods: MONTHS.map((m) => m.periodKey),
    teachers: [],
    unmatched: [],
    totals: {
      teachersMatched: 0,
      teachersUnmatched: 0,
      payEntries: 0,
      amountSum: 0,
      staffUpdates: 0,
    },
  }

  const approvedAt = new Date().toISOString()
  const payPayloads = []
  const staffUpdates = []

  for (const teacher of teachers) {
    const staff = findStaff(byName, teacher)
    if (!staff) {
      report.unmatched.push({
        csvName: teacher.csvName,
        canonicalName: teacher.canonicalName,
      })
      report.totals.teachersUnmatched += 1
      console.warn(`  UNMATCHED: ${teacher.csvName} → tried ${teacher.canonicalName}`)
      continue
    }

    report.totals.teachersMatched += 1
    const staffName = `${staff.first_name || ""} ${staff.last_name || ""}`.trim()

    const staffUpdate = {
      id: staff.id,
      pay_basis: teacher.isMonthly ? "monthly" : "hourly",
      hourly_rate: teacher.isMonthly ? null : teacher.hourlyRate,
      monthly_salary: teacher.isMonthly ? teacher.monthlySalary : null,
    }
    staffUpdates.push(staffUpdate)

    const monthRows = []
    for (const month of teacher.months) {
      if (month.payment == null || month.payment <= 0) continue

      const hoursWorked = teacher.isMonthly ? null : month.hours
      const amount = month.payment

      const payload = {
        organization_id: args.orgId,
        department_id: department.id,
        staff_id: staff.id,
        period_key: month.periodKey,
        period_start: month.periodStart,
        period_end: month.periodEnd,
        pay_basis: staffUpdate.pay_basis,
        hourly_rate: staffUpdate.hourly_rate,
        monthly_salary: staffUpdate.monthly_salary,
        hours_worked: hoursWorked,
        amount,
        status: "approved",
        approved_at: approvedAt,
        notes: IMPORT_TAG,
        updated_at: approvedAt,
      }
      payPayloads.push(payload)
      report.totals.payEntries += 1
      report.totals.amountSum += amount
      monthRows.push({
        periodKey: month.periodKey,
        hours: hoursWorked,
        amount,
      })
    }

    report.teachers.push({
      csvName: teacher.csvName,
      matchedStaff: staffName,
      staffId: staff.id,
      payBasis: staffUpdate.pay_basis,
      hourlyRate: staffUpdate.hourly_rate,
      monthlySalary: staffUpdate.monthly_salary,
      months: monthRows,
    })

    console.log(
      `  OK ${teacher.csvName} → ${staffName} (${staffUpdate.pay_basis}, ${monthRows.length} periods)`
    )
  }

  if (args.execute) {
    for (const update of staffUpdates) {
      const { error } = await sb
        .from("staff")
        .update({
          pay_basis: update.pay_basis,
          hourly_rate: update.hourly_rate,
          monthly_salary: update.monthly_salary,
          updated_at: approvedAt,
        })
        .eq("id", update.id)
        .eq("organization_id", args.orgId)
      if (error) {
        throw new Error(`staff update ${update.id}: ${error.message}`)
      }
      report.totals.staffUpdates += 1
    }

    // Upsert in chunks
    const chunkSize = 40
    for (let i = 0; i < payPayloads.length; i += chunkSize) {
      const chunk = payPayloads.slice(i, i + chunkSize)
      const { error } = await sb.from("department_staff_pay_entries").upsert(chunk, {
        onConflict: "organization_id,department_id,staff_id,period_key",
      })
      if (error) {
        throw new Error(`pay entry upsert: ${error.message}`)
      }
    }
    console.log(
      `Wrote ${report.totals.staffUpdates} staff updates and ${report.totals.payEntries} pay entries.`
    )
  } else {
    console.log(
      `Dry-run: would update ${staffUpdates.length} staff and upsert ${payPayloads.length} pay entries (total $${report.totals.amountSum.toFixed(2)}).`
    )
    console.log("Re-run with --execute to write.")
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const outPath = resolve(
    reportsDir,
    `qil-teacher-payroll-${stamp}${args.execute ? "-execute" : "-dry"}.json`
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Report: ${outPath}`)

  if (report.unmatched.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
